import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { absoluteSqliteUrl, rawDatabaseUrl, sqliteFilePath } from "@/lib/saas/dbUrl";
import { ensureQueryEngineEnv } from "@/lib/saas/enginePath";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma", "migrations");

function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  const flush = () => {
    const s = cur.trim();
    if (s && !/^(\s*--[^\r\n]*\s*)+$/.test(s)) out.push(s);
    cur = "";
  };
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      cur += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          cur += "'";
          i++;
        } else inStr = false;
      }
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? sql.length : nl + 1;
      cur += sql.slice(i, end);
      i = end - 1;
      continue;
    }
    if (ch === ";") {
      flush();
      continue;
    }
    cur += ch;
  }
  flush();
  return out;
}

async function recordApplied(
  client: PrismaClient,
  name: string,
  checksum: string,
) {
  await client.$executeRaw`
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, applied_steps_count, started_at)
    VALUES (${randomUUID()}, ${checksum}, CURRENT_TIMESTAMP, ${name}, 1, CURRENT_TIMESTAMP)`;
}

async function provision(): Promise<void> {
  const url = rawDatabaseUrl();
  const filePath = sqliteFilePath(url);
  if (!filePath) return;

  mkdirSync(path.dirname(filePath), { recursive: true });

  ensureQueryEngineEnv();
  const client = new PrismaClient({ datasourceUrl: absoluteSqliteUrl(url) });
  try {
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id VARCHAR(36) PRIMARY KEY NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        finished_at DATETIME,
        migration_name VARCHAR(255) NOT NULL,
        logs TEXT,
        applied_steps_count INTEGER NOT NULL DEFAULT 0,
        started_at DATETIME NOT NULL
      )`;

    const applied = await client.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    const done = new Set(applied.map((r) => r.migration_name));

    const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const name of dirs) {
      if (done.has(name)) continue;
      let sql: string;
      try {
        sql = readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
      } catch {
        continue;
      }
      const checksum = createHash("sha256").update(sql).digest("hex");
      try {
        for (const stmt of splitStatements(sql)) {
          await client.$executeRawUnsafe(stmt);
        }
        await recordApplied(client, name, checksum);
        console.log(`[saas-init] applied migration ${name}`);
      } catch (e) {
        if (/already exists/i.test(String(e))) {
          await recordApplied(client, name, checksum).catch(() => {});
          console.log(`[saas-init] migration ${name} already present`);
          continue;
        }
        throw e;
      }
    }
  } finally {
    await client.$disconnect().catch(() => {});
  }

  const { seedDefaultPlans } = await import("@/lib/saas/plans");
  await seedDefaultPlans();
}

let ready: Promise<void> | null = null;

export function initSaasDb(): Promise<void> {
  if (!ready) {
    ready = provision().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
