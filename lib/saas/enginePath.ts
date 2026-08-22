import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Locates a native Prisma Query Engine on disk and points PRISMA_QUERY_ENGINE_LIBRARY
 * at it before any PrismaClient is constructed.
 *
 * Why: hPanel's deploy pipeline does not ship lib/generated (gitignored) to the
 * runtime version dir, so the engine that `prisma generate` downloads never
 * reaches production. We therefore commit the production engine under
 * vendor/engines/ and resolve it at runtime. Order matters:
 *   1. an explicitly set env var wins
 *   2. lib/generated/prisma  (local dev: native platform engine from generate)
 *   3. node_modules/.prisma/client (classic generate location)
 *   4. vendor/engines (committed debian-openssl-1.1.x engine for production)
 */
let resolved = false;

function engineCandidates(): string[] {
  return [
    join(process.cwd(), "lib/generated/prisma"),
    join(process.cwd(), "node_modules/.prisma/client"),
    join(process.cwd(), "vendor/engines"),
  ];
}

function scoreEngine(fileName: string): number {
  const f = fileName.toLowerCase();
  if (process.platform === "win32") return f.endsWith(".dll.node") ? 0 : 10;
  if (process.platform === "darwin") return f.includes(".dylib.node") ? 0 : 10;
  // Linux: prefer the committed production target, then any other .so.node.
  if (!f.endsWith(".so.node")) return 20;
  return f.includes("debian-openssl-1.1.x") ? 0 : 1;
}

function pickEngine(dir: string): string | null {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return null;
  }
  const engines = files.filter((f) => /^.*query_engine.*\.(so|dll|dylib)\.node$/i.test(f));
  if (engines.length === 0) return null;
  engines.sort((a, b) => scoreEngine(a) - scoreEngine(b));
  return join(dir, engines[0]);
}

export function ensureQueryEngineEnv(): string | null {
  if (resolved) return process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? null;
  resolved = true;
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY && existsSync(process.env.PRISMA_QUERY_ENGINE_LIBRARY)) {
    return process.env.PRISMA_QUERY_ENGINE_LIBRARY;
  }
  for (const dir of engineCandidates()) {
    const found = pickEngine(dir);
    if (found) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = found;
      return found;
    }
  }
  return null;
}

export function queryEngineStatus(): { envSet: boolean; path: string | null } {
  ensureQueryEngineEnv();
  return {
    envSet: Boolean(process.env.PRISMA_QUERY_ENGINE_LIBRARY),
    path: process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? null,
  };
}
