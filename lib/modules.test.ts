import { describe, it, expect } from "vitest";
import {
  PMS_MODULES,
  MODULE_CATEGORIES,
  TOTAL_MODULES,
} from "./modules";

describe("PMS module catalogue", () => {
  it("contains exactly 23 modules", () => {
    expect(TOTAL_MODULES).toBe(23);
    expect(PMS_MODULES).toHaveLength(23);
  });

  it("every module has a name, tagline, and bullets", () => {
    for (const m of PMS_MODULES) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.tagline.length).toBeGreaterThan(0);
      expect(m.bullets.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every module references a valid category", () => {
    const ids = new Set(MODULE_CATEGORIES.map((c) => c.id));
    for (const m of PMS_MODULES) {
      expect(ids.has(m.category)).toBe(true);
    }
  });

  it("categories have unique ids, labels, and icons", () => {
    const ids = new Set<string>();
    const labels = new Set<string>();
    const icons = new Set<string>();
    for (const c of MODULE_CATEGORIES) {
      ids.add(c.id);
      labels.add(c.label);
      icons.add(c.icon);
    }
    expect(ids.size).toBe(MODULE_CATEGORIES.length);
    expect(labels.size).toBe(MODULE_CATEGORIES.length);
    expect(icons.size).toBe(MODULE_CATEGORIES.length);
  });
});
