import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateDemoInput, submitDemoRequest } from "./demo";
import { readData } from "./db";

let dirs: string[] = [];

async function tempTarget(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hs-demo-"));
  dirs.push(dir);
  return path.join(dir, "data.json");
}

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

describe("validateDemoInput", () => {
  it("accepts a valid request", () => {
    expect(
      validateDemoInput({ name: "Marta Alvarez", email: "marta@harborlights.com" }),
    ).toEqual({ ok: true });
  });

  it("rejects a missing name", () => {
    expect(validateDemoInput({ name: "", email: "marta@x.com" })).toMatchObject({
      ok: false,
      error: "Name is required",
    });
  });

  it("rejects a malformed email", () => {
    expect(validateDemoInput({ name: "Marta", email: "not-an-email" })).toMatchObject({
      ok: false,
      error: "Enter a valid email address",
    });
  });

  it("bounds property count between 1 and 5000", () => {
    expect(
      validateDemoInput({ name: "Marta", email: "m@x.com", propertyCount: 0 }),
    ).toMatchObject({ ok: false, error: "Property count must be between 1 and 5000" });
    expect(
      validateDemoInput({ name: "Marta", email: "m@x.com", propertyCount: 5001 }),
    ).toMatchObject({ ok: false, error: "Property count must be between 1 and 5000" });
    expect(
      validateDemoInput({ name: "Marta", email: "m@x.com", propertyCount: 250 }),
    ).toEqual({ ok: true });
  });
});

describe("submitDemoRequest", () => {
  it("persists a record with id, lowercased email and timestamp", async () => {
    const target = await tempTarget();
    const record = await submitDemoRequest(
      {
        name: "  Marta Alvarez  ",
        email: "Marta@HarborLights.com",
        propertyCount: 13,
        message: "We run a small coastal portfolio.",
      },
      target,
    );
    expect(validateDemoInput({ name: record.name, email: record.email })).toEqual({ ok: true });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.email).toBe("marta@harborlights.com");
    expect(record.name).toBe("Marta Alvarez");
    expect(record.propertyCount).toBe(13);
    expect(typeof record.createdAt).toBe("string");

    const doc = await readData(target);
    expect(doc.demoRequests).toHaveLength(1);
    expect(doc.demoRequests[0].id).toBe(record.id);
  });

  it("accumulates multiple requests", async () => {
    const target = await tempTarget();
    const { submitDemoRequest } = await import("./demo");
    await submitDemoRequest({ name: "A", email: "a@x.com" }, target);
    await submitDemoRequest({ name: "B", email: "b@x.com" }, target);
    const doc = await readData(target);
    expect(doc.demoRequests).toHaveLength(2);
  });

  it("throws on invalid input and stores nothing", async () => {
    const target = await tempTarget();
    const { submitDemoRequest } = await import("./demo");
    await expect(
      submitDemoRequest({ name: "A", email: "bad-email" }, target),
    ).rejects.toThrow("valid email");
    const doc = await readData(target);
    expect(doc.demoRequests).toHaveLength(0);
  });
});
