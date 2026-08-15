import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Property } from "./types";

const PROPS: Property[] = [
  {
    slug: "the-royal-sandpiper",
    name: "The Royal Sandpiper",
    city: "Cape Town",
    country: "South Africa",
    type: "Hotel",
    claimed: true,
    color: "emerald",
    signals: {
      platforms: { google: { present: true, rating: 4.6, maxRating: 5, reviewCount: 820, reviewsRecent30: 42, responseRate: 0.95 } },
      presence: { gbpCompleteness: 0.95, websiteQuality: 92, socialScore: 84, directoryListings: 6, localPackVisible: true },
    },
  },
];

describe("lib/saved", () => {
  async function isolated() {
    const dir = await mkdtemp(path.join(tmpdir(), "hs-saved-"));
    const target = path.join(dir, "data.json");
    const { addSaved, listSaved, isSaved, removeSaved, refreshSaved } = await import("./saved");
    return { dir, target, addSaved, listSaved, isSaved, removeSaved, refreshSaved };
  }

  it("adds, lists and unsaves for a user", async () => {
    const ctx = await isolated();
    try {
      const saved = await ctx.addSaved("user-1", PROPS[0], ctx.target);
      expect(saved.slug).toBe("the-royal-sandpiper");
      expect(saved.history).toHaveLength(1);
      expect(await ctx.isSaved("user-1", PROPS[0].slug, ctx.target)).toBe(true);
      expect(await ctx.listSaved("user-1", ctx.target)).toHaveLength(1);
      expect(await ctx.removeSaved("user-1", PROPS[0].slug, ctx.target)).toBe(true);
      expect(await ctx.isSaved("user-1", PROPS[0].slug, ctx.target)).toBe(false);
    } finally {
      await rm(ctx.dir, { recursive: true, force: true });
    }
  });

  it("refresh appends history and isolates users", async () => {
    const ctx = await isolated();
    try {
      await ctx.addSaved("user-1", PROPS[0], ctx.target);
      const refreshed = await ctx.refreshSaved("user-1", PROPS[0].slug, ctx.target);
      expect(refreshed?.history).toHaveLength(2);
      // other user unaffected
      await ctx.addSaved("user-1", PROPS[0], ctx.target);
      expect(await ctx.listSaved("user-2", ctx.target)).toHaveLength(0);
    } finally {
      await rm(ctx.dir, { recursive: true, force: true });
    }
  });
});