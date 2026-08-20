import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getPricingDoc, savePricingDoc, resetPricingDoc, profileErrors } from "./db";
import { SEED_PROFILES } from "./defaults";

let dirs: string[] = [];

async function tempTarget(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hs-pricing-"));
  dirs.push(dir);
  return path.join(dir, "data.json");
}

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

describe("getPricingDoc", () => {
  it("seeds version 1 with every configured country", async () => {
    const target = await tempTarget();
    const doc = await getPricingDoc(target);
    expect(doc.version).toBe(1);
    expect(Object.keys(doc.profiles)).toHaveLength(16);
    expect(doc.profiles.IN.prices.solopreneur).toEqual({ monthly: 999, annual: 9990 });
    expect(doc.profiles.US.prices.solopreneur).toEqual({ monthly: 49, annual: 490 });
    expect(doc.profiles.IN.tax.label).toBe("GST");
  });

  it("loads the persisted document on later reads", async () => {
    const target = await tempTarget();
    const first = await getPricingDoc(target);
    first.profiles.IN.prices.solopreneur.monthly = 1199;
    await savePricingDoc(
      { profiles: first.profiles, label: "IN update", byEmail: "ops@hospios.com" },
      target,
    );
    const reread = await getPricingDoc(target);
    expect(reread.version).toBe(2);
    expect(reread.profiles.IN.prices.solopreneur.monthly).toBe(1199);
  });
});

describe("savePricingDoc", () => {
  it("creates a new version and snapshots the previous one", async () => {
    const target = await tempTarget();
    const current = await getPricingDoc(target);
    const next = await savePricingDoc(
      {
        profiles: {
          ...current.profiles,
          IN: {
            ...current.profiles.IN,
            prices: {
              ...current.profiles.IN.prices,
              solopreneur: { monthly: 1199, annual: 11990 },
            },
          },
        },
        label: "India reprice",
        byEmail: "ops@hospios.com",
      },
      target,
    );

    expect(next.version).toBe(2);
    expect(next.profiles.IN.prices.solopreneur.monthly).toBe(1199);
    expect(next.history).toHaveLength(1);
    expect(next.history[0].version).toBe(1);
    expect(next.history[0].profiles.IN.prices.solopreneur.monthly).toBe(999);
    expect(next.history[0].label).toBe("Initial configuration");
  });

  it("is a no-op when nothing changed (no version bump)", async () => {
    const target = await tempTarget();
    const current = await getPricingDoc(target);
    const next = await savePricingDoc(
      { profiles: current.profiles, label: "bump", byEmail: "ops@hospios.com" },
      target,
    );
    expect(next.version).toBe(1);
    expect(next.history).toHaveLength(0);
  });

  it("rejects invalid profiles with a clear error", async () => {
    const target = await tempTarget();
    const current = await getPricingDoc(target);
    const bad = {
      ...current.profiles,
      IN: {
        ...current.profiles.IN,
        tax: { ...current.profiles.IN.tax, rate: 150 },
      },
    };
    await expect(
      savePricingDoc({ profiles: bad, label: "bad", byEmail: "ops@x.com" }, target),
    ).rejects.toThrow(/Tax rate/);

    const badCurrency = {
      ...current.profiles,
      DE: { ...current.profiles.DE, currency: "XYZ" },
    };
    await expect(
      savePricingDoc({ profiles: badCurrency, label: "bad", byEmail: "ops@x.com" }, target),
    ).rejects.toThrow(/Unknown currency/);
  });
});

describe("resetPricingDoc", () => {
  it("restores seed prices behind a new version", async () => {
    const target = await tempTarget();
    const current = await getPricingDoc(target);
    await savePricingDoc(
      {
        profiles: {
          ...current.profiles,
          IN: {
            ...current.profiles.IN,
            prices: {
              ...current.profiles.IN.prices,
              solopreneur: { monthly: 5000, annual: 50000 },
            },
          },
        },
        label: "experiment",
        byEmail: "ops@hospios.com",
      },
      target,
    );
    const reset = await resetPricingDoc("ops@hospios.com", target);
    expect(reset.version).toBe(3);
    expect(reset.profiles.IN.prices.solopreneur.monthly).toBe(999);
    expect(reset.history).toHaveLength(2);
    expect(reset.history[1].profiles.IN.prices.solopreneur.monthly).toBe(5000);
  });
});

describe("profileErrors", () => {
  it("accepts a valid profile", () => {
    expect(profileErrors(SEED_PROFILES.ZA!)).toEqual([]);
  });

  it("flags missing enterprise-zero constraint and bad codes", () => {
    const mutated = structuredClone(SEED_PROFILES.US!);
    mutated.prices.enterprise = { monthly: 1, annual: 2 };
    const errs = profileErrors(mutated);
    expect(errs.some((e) => e.includes("Enterprise prices must be 0"))).toBe(true);
  });
});