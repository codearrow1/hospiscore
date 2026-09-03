import { describe, it, expect } from "vitest";
import { buildLeadsHref, buildDemosHref } from "./links";

const baseLeads = {
  q: "",
  stage: "all",
  source: "all",
  country: "",
  plan: "",
  band: "all",
  owner: "",
};

const baseDemos = {
  q: "",
  status: "",
  owner: "",
  period: "",
  country: "",
  stage: "",
  source: "",
  demoType: "",
  followUp: "",
};

describe("buildLeadsHref", () => {
  it("returns the bare path for default state", () => {
    expect(buildLeadsHref(baseLeads, { sort: "updatedAt", dir: "desc", page: 1, perPage: 20 }, {})).toBe("/marketing-admin/leads");
  });

  it("serializes non-default filters and drops defaults", () => {
    const href = buildLeadsHref(
      { ...baseLeads, q: "acme", stage: "qualified", owner: "a@x.io", country: "IN" },
      { sort: "updatedAt", dir: "desc", page: 2, perPage: 20 },
      {},
    );
    expect(href).toContain("q=acme");
    expect(href).toContain("stage=qualified");
    expect(href).toContain("owner=a%40x.io");
    expect(href).toContain("country=IN");
    expect(href).toContain("page=2");
    expect(href).not.toContain("band=all");
    expect(href).not.toContain("source=all");
    expect(href).not.toContain("dir=desc");
    expect(href).not.toContain("sort=updatedAt");
  });

  it("applies a patch on top of current state and clears page on filter change", () => {
    const href = buildLeadsHref(
      { ...baseLeads, stage: "qualified" },
      { sort: "score", dir: "asc", page: 4, perPage: 10 },
      { stage: "trial" },
    );
    expect(href).toContain("stage=trial");
    expect(href).toContain("sort=score");
    expect(href).toContain("dir=asc");
    expect(href).toContain("perPage=10");
    expect(href).not.toContain("page=");
  });

  it("keeps page when the patch only changes sorting", () => {
    const href = buildLeadsHref(
      baseLeads,
      { sort: "updatedAt", dir: "desc", page: 3, perPage: 20 },
      { sort: "score" },
    );
    expect(href).toContain("page=3");
    expect(href).toContain("sort=score");
  });

  it("drops empty strings even when patched with a defined empty value", () => {
    const href = buildLeadsHref(
      { ...baseLeads, stage: "qualified" },
      { sort: "updatedAt", dir: "desc", page: 2, perPage: 20 },
      { stage: "all" },
    );
    expect(href).not.toContain("stage=");
  });
});

describe("buildDemosHref", () => {
  it("returns the bare path for default state", () => {
    expect(buildDemosHref(baseDemos, { view: "week", sort: "startAt", dir: "asc", page: 1, perPage: 20 }, {})).toBe("/marketing-admin/demos");
  });

  it("includes week only when present", () => {
    const withWeek = buildDemosHref(baseDemos, { view: "week", week: "2026-09-07", sort: "startAt", dir: "asc", page: 1, perPage: 20 }, {});
    expect(withWeek).toContain("week=2026-09-07");
    const withoutWeek = buildDemosHref(baseDemos, { view: "week", sort: "startAt", dir: "asc", page: 1, perPage: 20 }, {});
    expect(withoutWeek).not.toContain("week=");
  });

  it("applies a patch and clears page on filter change", () => {
    const href = buildDemosHref(
      { ...baseDemos, status: "confirmed" },
      { view: "list", sort: "startAt", dir: "asc", page: 5, perPage: 50 },
      { status: "cancelled", q: "rico" },
    );
    expect(href).toContain("status=cancelled");
    expect(href).toContain("q=rico");
    expect(href).not.toContain("page=");
  });

  it("clears week when patched away", () => {
    const href = buildDemosHref(
      { ...baseDemos, status: "confirmed" },
      { view: "week", week: "2026-09-07", sort: "startAt", dir: "asc", page: 1, perPage: 20 },
      { week: undefined },
    );
    expect(href).toContain("status=confirmed");
    expect(href).not.toContain("week=");
  });
});