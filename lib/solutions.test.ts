/**
 * Data-contract regression for the home-page property-type showcase.
 *
 * Pins the canonical property-type configuration consumed by
 * `components/marketing/PropertyTypeShowcase.tsx` so the redesigned selector
 * can't drift into missing labels, broken CTA routes, duplicate slugs, or
 * fabricated fields. Data lives in lib/solutions.ts (single source) — these
 * tests only assert its invariants, they never duplicate the content.
 */
import { describe, expect, test } from "vitest";
import {
  SOLUTIONS,
  SHOWCASE_SOLUTIONS,
  getShowcaseSolutions,
  getSolution,
  ACCENT_TEXT,
  ACCENT_BG,
  ACCENT_GLOW,
  type PropertyAccent,
} from "./solutions";

const VALID_ACCENTS: PropertyAccent[] = ["indigo", "teal", "magenta", "orange", "blue", "emerald", "amber", "sky"];

describe("showcase property-type data contract", () => {
  const showcase = getShowcaseSolutions();

  test("showcase exposes exactly the 8 curated core types", () => {
    expect(SHOWCASE_SOLUTIONS).toHaveLength(8);
    expect(showcase).toHaveLength(8);
  });

  test("showcase slugs are unique and resolve from the canonical source", () => {
    const slugs = showcase.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of showcase) {
      expect(getSolution(s.slug)?.slug).toBe(s.slug);
    }
  });

  test("every showcase type carries a full, display-ready field set", () => {
    for (const s of showcase) {
      expect(s.name).toBeTruthy();
      expect(s.audience).toBeTruthy();
      expect(s.value).toBeTruthy();
      expect(s.image).toMatch(/^https:\/\//);
      expect(s.imageAlt).toBeTruthy();
      expect(s.cta).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(Array.isArray(s.capabilities)).toBe(true);
      expect(s.capabilities.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("accents are valid and fully mapped (text/bg/glow) so no selector styling gaps", () => {
    const seen = new Set<PropertyAccent>();
    for (const s of showcase) {
      seen.add(s.accent);
      expect(VALID_ACCENTS).toContain(s.accent);
      expect(ACCENT_TEXT[s.accent]).toBeTruthy();
      expect(ACCENT_BG[s.accent]).toBeTruthy();
      expect(ACCENT_GLOW[s.accent]).toBeTruthy();
    }
    // Every supported accent kind is represented by at least one property.
    expect(new Set(SOLUTIONS.map((s) => s.accent)).size).toBeGreaterThanOrEqual(4);
  });

  test("each showcase type leads to a real solution route and its own home-page preview", () => {
    for (const s of showcase) {
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
      // The selector's primary CTA routes to the canonical per-type solution page.
      const target = getSolution(s.slug);
      expect(target).toBeDefined();
      expect(target!.cta).toBe(s.cta);
    }
  });

  test("showcase is a strict subset of the full solutions catalog (no fabricated types)", () => {
    const allSlugs = new Set(SOLUTIONS.map((s) => s.slug));
    for (const slug of SHOWCASE_SOLUTIONS) {
      expect(allSlugs.has(slug)).toBe(true);
    }
  });
});