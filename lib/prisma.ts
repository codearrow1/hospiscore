import { PrismaClient } from "@/lib/generated/prisma/client";
import { absoluteSqliteUrl } from "@/lib/saas/dbUrl";
import { ensureQueryEngineEnv } from "@/lib/saas/enginePath";

declare global {
  var __prisma: PrismaClient | undefined;
}

// Must run before PrismaClient construction: points the engine env var at the
// packaged native engine (vendor/engines on production, native on dev).
ensureQueryEngineEnv();

// Runtime fallback mirrors prisma.config.ts so the app boots (and migrations
// land in the same file) even when DATABASE_URL is not provisioned yet.
// Relative file: URLs are normalized to absolute from the project cwd so the
// engine always opens the same file prisma.config.ts / migrations target.
const DATABASE_URL = absoluteSqliteUrl();

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasourceUrl: DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

export default prisma;
