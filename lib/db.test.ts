import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dirs: string[] = [];
const handles: { close(): void }[] = [];

async function tempPath(name: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hs-db-"));
  dirs.push(dir);
  return path.join(dir, name);
}

function readRaw(file: string): Promise<string> {
  return readFile(file, "utf8");
}

afterEach(async () => {
  handles.forEach((h) => {
    try {
      h.close();
    } catch {
      /* already closed */
    }
  });
  handles.length = 0;
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

describe("file backend (via facade)", () => {
  it("persists a document and keeps prior writes", async () => {
    const target = await tempPath("data.json");
    const { writeData, readData } = await import("./db");
    await writeData(
      (d) => ({ ...d, users: [{ id: "u1", name: "A", email: "a@x.com", createdAt: "t", passwordHash: "h" }] }),
      target,
    );
    await writeData((d) => ({ ...d, saved: { u1: [] } }), target);
    const doc = await readData(target);
    expect(doc.users).toHaveLength(1);
    expect(doc.saved.u1).toEqual([]);
  });
});

describe("file backend mirror recovery", () => {
  it("reads from the mirror when the primary file is lost", async () => {
    const { FileDataBackend } = await import("./db");
    const primary = await tempPath("data.json");
    const mirror = await tempPath("mirror.json");

    const a = new FileDataBackend(primary, mirror);
    await a.write((d) => ({
      ...d,
      users: [{ id: "u1", name: "A", email: "a@x.com", createdAt: "t", passwordHash: "h" }],
    }));
    // mirror was written alongside the primary
    await expect(readRaw(mirror)).resolves.toContain("u1");

    // Simulate a deploy that wiped the app directory.
    await rm(primary, { force: true });
    const b = new FileDataBackend(primary, mirror);
    const doc = await b.read();
    expect(doc.users.map((u) => u.id)).toEqual(["u1"]);

    // The next write recreates the primary from the recovered document.
    await b.write((d) => ({ ...d, saved: { u1: [] } }));
    const c = new FileDataBackend(primary, mirror);
    const again = await c.read();
    expect(again.users.map((u) => u.id)).toEqual(["u1"]);
    expect(again.saved.u1).toEqual([]);
  });

  it("prefers the mirror when the primary resets to an empty document", async () => {
    const { FileDataBackend } = await import("./db");
    const primary = await tempPath("data.json");
    const mirror = await tempPath("mirror.json");

    const a = new FileDataBackend(primary, mirror);
    await a.write((d) => ({
      ...d,
      users: [{ id: "u1", name: "A", email: "a@x.com", createdAt: "t", passwordHash: "h" }],
    }));
    await writeFile(primary, JSON.stringify({ users: [], sessions: [], saved: {} }, null, 2), "utf8");

    const b = new FileDataBackend(primary, mirror);
    const doc = await b.read();
    expect(doc.users.map((u) => u.id)).toEqual(["u1"]);
  });

  it("returns an empty store when both files are fresh", async () => {
    const { FileDataBackend } = await import("./db");
    const primary = await tempPath("data.json");
    const mirror = await tempPath("mirror.json");
    const backend = new FileDataBackend(primary, mirror);
    const doc = await backend.read();
    expect(doc.users).toEqual([]);
    expect(doc.leads).toEqual([]);
  });
});

describe("sqlite backend", () => {
  it("writes and reads through the same interface", async () => {
    const file = await tempPath("data.db");
    const { SqliteDataBackend } = await import("./db/sqlite");
    const backend = new SqliteDataBackend(file);
    handles.push(backend);

    const first = await backend.write((d) => ({
      ...d,
      users: [{ id: "u1", name: "A", email: "a@x.com", createdAt: "t", passwordHash: "h" }],
    }));
    expect(first.users).toHaveLength(1);

    const second = await backend.write((d) => ({
      ...d,
      users: [...d.users, { id: "u2", name: "B", email: "b@x.com", createdAt: "t", passwordHash: "h" }],
    }));
    expect(second.users).toHaveLength(2);

    const read = await backend.read();
    expect(read.users.map((u) => u.id).sort()).toEqual(["u1", "u2"]);
  });

  it("survives reopening the file", async () => {
    const file = await tempPath("data.db");
    const { SqliteDataBackend } = await import("./db/sqlite");
    const a = new SqliteDataBackend(file);
    handles.push(a);
    await a.write((d) => ({
      ...d,
      saved: { u1: [] },
    }));
    a.close();
    const b = new SqliteDataBackend(file);
    handles.push(b);
    const doc = await b.read();
    expect(doc.saved.u1).toEqual([]);
  });
});