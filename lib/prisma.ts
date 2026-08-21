import { PrismaClient } from "@/lib/generated/prisma/client";
import { absoluteSqliteUrl } from "@/lib/saas/dbUrl";

declare global {
  var __prisma: PrismaClient | undefined;
}

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
