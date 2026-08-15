import { describe, it, expect } from "vitest";
import { MemoryBackend, cacheOrCompute } from "@/lib/cache";

describe("MemoryBackend", () => {
  it("stores and reads a value", async () => {
    const b = new MemoryBackend();
    await b.set("a", { ok: 1 }, 60);
    expect(await b.get("a")).toEqual({ ok: 1 });
  });

  it("expires entries after their TTL", async () => {
    const b = new MemoryBackend();
    await b.set("k", "v", 0.05); // 50ms
    expect(await b.get("k")).toBe("v");
    await new Promise((r) => setTimeout(r, 80));
    expect(await b.get("k")).toBeNull();
  });

  it("deletes entries", async () => {
    const b = new MemoryBackend();
    await b.set("k", 1, 60);
    await b.delete("k");
    expect(await b.get("k")).toBeNull();
  });
});

describe("cacheOrCompute", () => {
  it("computes on first call, caches on subsequent calls", async () => {
    const b = new MemoryBackend();
    let calls = 0;
    const compute = () => {
      calls += 1;
      return `v-${calls}`;
    };

    // Replace the module backend with our instance for a clean, isolated test.
    const first = await cacheOrCompute("t1", compute, 60, b);
    const second = await cacheOrCompute("t1", compute, 60, b);
    expect(first).toBe("v-1");
    expect(second).toBe("v-1"); // not recomputed
    expect(calls).toBe(1);
  });

  it("computes fresh for different keys", async () => {
    const b = new MemoryBackend();
    const compute = () => ({ t: Date.now() });
    const a = await cacheOrCompute("k1", compute, 60, b);
    const b2 = await cacheOrCompute("k2", compute, 60, b);
    expect(a).not.toBe(b2);
  });
});