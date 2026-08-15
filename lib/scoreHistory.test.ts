import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileScoreStore, takeSnapshot, getScoreStore } from "@/lib/scoreHistory";
import { computeScore } from "@/lib/scoring";
import { findProperty } from "@/lib/data";

let tempDir = "";

afterAll(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe("FileScoreStore", () => {
  it("persists snapshots and returns them oldest → newest", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "hospiscore-"));
    const store = new FileScoreStore(tempDir);

    expect(await store.history("prop-1")).toEqual([]);

    await store.save("prop-1", {
      at: "2026-08-04T00:00:00.000Z",
      overall: 80,
      grade: "Good",
      platformsCount: 3,
      totalReviews: 100,
    });
    await store.save("prop-1", {
      at: "2026-08-05T00:00:00.000Z",
      overall: 82,
      grade: "Good",
      platformsCount: 3,
      totalReviews: 100,
    });

    const history = await store.history("prop-1");
    expect(history).toHaveLength(2);
    expect(history[0].overall).toBe(80);
    expect(history[1].overall).toBe(82);
  });

  it("does not bleed between properties", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "hospiscore-"));
    const store = new FileScoreStore(tempDir);
    await store.save("a", {
      at: "2026-08-05T00:00:00.000Z",
      overall: 90,
      grade: "Excellent",
      platformsCount: 5,
      totalReviews: 500,
    });
    expect(await store.history("b")).toEqual([]);
  });
});

describe("takeSnapshot", () => {
  it("computes and stores a snapshot for a real property", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "hospiscore-"));
    const prop = findProperty("the-royal-sandpiper");
    expect(prop).toBeDefined();
    if (!prop) return;

    const result = computeScore(prop.signals);
    const snap = await takeSnapshot(prop.slug, prop, result);

    expect(snap.overall).toBe(result.overall);
    expect(snap.grade).toBe(result.grade);
    expect(new Date(snap.at).getTime()).toBeLessThanOrEqual(Date.now());

    const history = await getScoreStore().history(prop.slug);
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].overall).toBe(result.overall);
  });
});