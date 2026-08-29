/**
 * Health endpoint integration test (Phase 3).
 *
 * Validates the public liveness/readiness GET /api/health route against a real,
 * isolated temp SQLite DB — proving the new launch-blocker fix (no unauthenticated
 * health probe existed) works end to end.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

// ---- Harness bootstrap (must precede every @/ import) --------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hospios-health-"));
const tmpDbUrl = "file:" + path.join(tmpDir, "health.db").replace(/\\/g, "/");
process.env.DATABASE_URL = tmpDbUrl;

type HttpRoute = { GET: () => Promise<Response> };

let route: HttpRoute;
let prisma: { $disconnect(): Promise<void> } | undefined;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate", { env: process.env, stdio: "pipe" });
  const mod = await import("@/app/api/health/route");
  route = { GET: mod.GET } as HttpRoute;
  const p = await import("@/lib/prisma");
  prisma = p.prisma;
}, 180_000);

afterAll(async () => {
  try {
    if (prisma) await prisma.$disconnect();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("GET /api/health", () => {
  test("returns 200 with db up when the backend is healthy", async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, app: "ok", db: "up" });
    expect(typeof body.time).toBe("string");
  });
});
