import { CONFIG } from "@/lib/config";
import { createRequire } from "node:module";
import { join } from "node:path";

// Points at <project>/node_modules so the optional `redis` package can be
// required at runtime without being statically bundled (it's not installed by
// default). createRequire-based requires are left as runtime imports by Next.
const require = createRequire(join(process.cwd(), "package.json"));

/**
 * TTL cache with async get/set and pluggable backends.
 *
 *  - Default backend is in-memory (Map + expiry), requires nothing.
 *  - Set CACHE_PROVIDER=redis and REDIS_URL to use Redis (requires the optional
 *    `redis` dependency). Redis is only loaded lazily when actually configured,
 *    so the app works fine without it installed.
 */

export interface CacheBackend {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/* ---------------------------- In-memory ---------------------------- */

/** In-memory TTL backend. Exported for tests. */
export class MemoryBackend implements CacheBackend {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get(key: string): Promise<unknown | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/* ------------------------------ Redis ------------------------------ */

async function createRedisBackend(): Promise<CacheBackend> {
  // Optional dependency: only load when Redis is actually configured.
  const { createClient } = require("redis") as {
    createClient: (options: { url: string }) => {
      connect(): Promise<void>;
      get(key: string): Promise<string | null>;
      set(
        key: string,
        value: string,
        options?: { EX: number },
      ): Promise<unknown>;
      del(...keys: string[]): Promise<number>;
    };
  };
  const client = createClient({ url: CONFIG.redisUrl });
  await client.connect();

  return {
    async get(key) {
      const value = await client.get(key);
      if (value == null) return null;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    },
    async set(key, value, ttlSeconds) {
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    },
    async delete(key) {
      await client.del(key);
    },
  };
}

let backendPromise: Promise<CacheBackend> | null = null;

function backend(): Promise<CacheBackend> {
  if (!backendPromise) {
    backendPromise = CONFIG.cacheProvider === "redis"
      ? createRedisBackend().catch((err) => {
          console.error("Redis unavailable, using in-memory cache:", err);
          return new MemoryBackend();
        })
      : Promise.resolve(new MemoryBackend());
  }
  return backendPromise;
}

/**
 * Return a cached value or compute + cache it.
 * `ttlSeconds` is capped to zero when caching is disabled globally.
 */
export async function cacheOrCompute<T>(
  key: string,
  compute: () => Promise<T> | T,
  ttlSeconds: number,
  testBackend?: CacheBackend, // injected by tests for isolation
): Promise<T> {
  if (!CONFIG.enableCache) return compute();
  const b = testBackend ?? (await backend());
  const cached = await b.get(key);
  if (cached != null) return cached as T;
  const value = await compute();
  await b.set(key, value, ttlSeconds);
  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  const b = await backend();
  await b.delete(key);
}

export function cacheKey(parts: string[]): string {
  return parts.join(":");
}