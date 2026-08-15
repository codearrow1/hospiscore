import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  cookieFromToken,
  createSessionRecord,
  isExpired,
} from "./auth";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const encoded = await hashPassword("secret-pass");
    expect(encoded).toMatch(/^scrypt:/);
    expect(await verifyPassword("secret-pass", encoded)).toBe(true);
  });

  it("rejects wrong and malformed inputs", async () => {
    const encoded = await hashPassword("a-password");
    expect(await verifyPassword("wrong", encoded)).toBe(false);
    expect(await verifyPassword("a-password", "garbage")).toBe(false);
    expect(await verifyPassword("a-password", "scrypt:aaa")).toBe(false);
  });
});

describe("session tokens", () => {
  it("derives a stable 64-hex cookie value from a token and never equals it", () => {
    const token = newSessionToken();
    const cookie = cookieFromToken(token);
    expect(cookie).not.toBe(token);
    expect(cookieFromToken(token)).toBe(cookie);
  });

  it("creates non-expired session records", () => {
    const s = createSessionRecord("u1");
    expect(s.userId).toBe("u1");
    expect(isExpired(s)).toBe(false);
  });
});

describe("db file persistence", () => {
  async function tempDir() {
    return mkdtemp(path.join(tmpdir(), "hs-test-"));
  }

  it("persists and reads back the data file", async () => {
    const dir = await tempDir();
    const target = path.join(dir, "data.json");
    const { writeData, readData } = await import("./db");
    try {
      await writeData((d) => ({ ...d, users: [...d.users, { id: "u", name: "n", email: "e", createdAt: "t", passwordHash: "h" }] }), target);
      const loaded = await readData(target);
      expect(loaded.users).toHaveLength(1);
      expect(loaded.users[0].id).toBe("u");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});