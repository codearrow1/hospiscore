import { describe, expect, it } from "vitest";
import { PMS_MODULES } from "@/lib/modules";
import { FEATURE_CONTENT, MODULE_ALIASES } from "@/lib/featurePages";

describe("featurePages content coverage", () => {
  it("has a FEATURE_CONTENT entry for every PMS module", () => {
    for (const mod of PMS_MODULES) {
      expect(
        FEATURE_CONTENT[mod.id],
        `missing FEATURE_CONTENT for module "${mod.id}"`,
      ).toBeDefined();
    }
  });

  it("every entry has a headline, intro, 3 highlights, and 2 FAQs", () => {
    for (const mod of PMS_MODULES) {
      const content = FEATURE_CONTENT[mod.id];
      expect(content.headline.trim().length, `${mod.id}.headline`).toBeGreaterThan(0);
      expect(content.intro.trim().length, `${mod.id}.intro`).toBeGreaterThan(0);
      expect(content.highlights).toHaveLength(3);
      for (const h of content.highlights) {
        expect(h.title.trim().length).toBeGreaterThan(0);
        expect(h.body.trim().length).toBeGreaterThan(0);
      }
      expect(content.faqs.length, `${mod.id}.faqs`).toBeGreaterThanOrEqual(2);
      for (const f of content.faqs) {
        expect(f.q.trim().length).toBeGreaterThan(0);
        expect(f.a.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("every alias resolves to a real module id", () => {
    const ids = new Set(PMS_MODULES.map((m) => m.id));
    for (const [slug, id] of Object.entries(MODULE_ALIASES)) {
      expect(slug.trim().length).toBeGreaterThan(0);
      expect(ids.has(id), `alias "${slug}" → unknown module "${id}"`).toBe(true);
    }
  });
});
