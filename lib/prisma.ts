import { PrismaClient } from "@/lib/generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

// Runtime fallback mirrors prisma.config.ts so the app boots (and migrations
// land in the same file) even when DATABASE_URL is not provisioned yet.
const DATABASE_URL = process.env.DATABASE_URL || "file:./var/saas.db";

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasourceUrl: DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

export default prisma;
