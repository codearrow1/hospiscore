/**
 * Minimal ambient types for the optional `redis` package.
 *
 * These apply only while the real package isn't installed (the app's default
 * cache backend is in-memory). Once you `npm i redis`, the package's own type
 * declarations take precedence and this file is effectively ignored.
 */
declare module "redis" {
  export interface RedisClient {
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(
      key: string,
      value: string,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
    del(...keys: string[]): Promise<number>;
  }
  export function createClient(options?: Record<string, unknown>): RedisClient;
}
