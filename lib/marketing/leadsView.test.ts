import { describe, it, expect } from "vitest";
import {
  isStaleLead,
  followUpStateOf,
  dealAgeDays,
  daysInStage,
  isDemoLeadId,
  demoStatusOf,
  isConverted,
  qualityFlagsOf,
  toLeadRow,
  buildLeadRows,
  leadsKpis,
  funnelOf,
  openValueByCurrency,
} from "./leadsView";
import { PIPELINE_STAGES } from "./stages";
import type { MarketingLead, DemoBooking, ConvertedCustomer } from "./types";

const DAY = 86_400_000;

function lead(over: Partial<MarketingLead> = {}): MarketingLead {
  const now = Date.now();
  return {
    id: "lead-1",
    name: "Marta",
    email: "m@harbor.com",
    phone: "+91 90000 00000",
    source: "direct",
    score: 30,
    band: "hot",
    stage: "new",
    estimatedValue: 0,
    notes: [],
    attribution: {},
    createdAt: new Date(now - 10 * DAY).toISOString(),
    updatedAt: new Date(now - 3 * DAY).toISOString(),
    ...over,
  };
}

function demo(over: Partial<DemoBooking> = {}): DemoBooking {
  return {
    id: "demo-1",
    leadId: "lead-1",
    startAt: new Date(Date.now() + DAY).toISOString(),
    durationMin: 45,
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe("stale & follow-up derivation", () => {
  it("flags stale only when untouched for 14+ days", () => {
    const now = Date.now();
    expect(isStaleLead(lead({ updatedAt: new Date(now - 15 * DAY).toISOString() }), now)).toBe(true);
    expect(isStaleLead(lead({ updatedAt: new Date(now - 10 * DAY).toISOString() }), now)).toBe(false);
    // lastContactAt counts as activity even if updatedAt is old.
    expect(
      isStaleLead(
        lead({
          updatedAt: new Date(now - 20 * DAY).toISOString(),
          lastContactAt: new Date(now - 3 * DAY).toISOString(),
        }),
        now,
      ),
    ).toBe(false);
  });

  it("derives follow-up status only from a real scheduled date", () => {
    const now = Date.now();
    expect(followUpStateOf(undefined, now).status).toBe("none");
    expect(followUpStateOf(new Date(now - DAY).toISOString(), now).status).toBe("overdue");
    expect(followUpStateOf(new Date(now + 3 * DAY).toISOString(), now).status).toBe("due");
    expect(followUpStateOf(new Date(now + 30 * DAY).toISOString(), now).status).toBe("later");
    expect(followUpStateOf("not-a-date", now).status).toBe("none");
    expect(followUpStateOf(new Date(now - 5 * DAY).toISOString(), now)).toEqual(
      expect.objectContaining({ status: "overdue", daysFromNow: expect.any(Number) }),
    );
  });
});

describe("age derivation", () => {
  it("computes deal age from createdAt", () => {
    const now = Date.now();
    expect(dealAgeDays(lead({ createdAt: new Date(now - 5 * DAY).toISOString() }), now)).toBe(5);
  });
  it("computes days in stage from updatedAt", () => {
    const now = Date.now();
    expect(daysInStage(lead({ updatedAt: new Date(now - 2 * DAY).toISOString() }), now)).toBe(2);
  });
});

describe("demo helpers", () => {
  it("identifies seeded demo leads by id prefix", () => {
    expect(isDemoLeadId("lead-demo-abc")).toBe(true);
    expect(isDemoLeadId("lead-abc")).toBe(false);
  });
  it("maps a real demo status to a summary", () => {
    expect(demoStatusOf(undefined)).toBe("none");
    expect(demoStatusOf(undefined, "demo-1")).toBe("scheduled");
    expect(demoStatusOf(demo({ status: "confirmed" }))).toBe("scheduled");
    expect(demoStatusOf(demo({ status: "completed" }))).toBe("completed");
    expect(demoStatusOf(demo({ status: "no_show" }))).toBe("no_show");
    expect(demoStatusOf(demo({ status: "cancelled" }))).toBe("cancelled");
  });
});

describe("conversion + quality", () => {
  it("detects conversion from convertedCustomerId or a real matching record", () => {
    const converted: ConvertedCustomer[] = [
      { id: "c1", leadId: "lead-9", convertedAt: new Date().toISOString(), estimatedValue: 0 },
    ];
    expect(isConverted(lead({ id: "lead-9" }), converted)).toBe(true);
    expect(isConverted(lead({ convertedCustomerId: "c1" }), converted)).toBe(true);
    expect(isConverted(lead({ id: "lead-1" }), converted)).toBe(false);
  });
  it("flags data-quality gaps from the real record", () => {
    const complete = qualityFlagsOf(lead({ propertyName: "Harbor Inn", company: "Harbor Hotels" }));
    expect(complete).toEqual(
      expect.objectContaining({ missingEmail: false, missingPhone: false, missingProperty: false, incomplete: false }),
    );
    const gappy = qualityFlagsOf(lead({ email: "", phone: "", propertyName: "", company: "", source: "other", ownerEmail: undefined }));
    expect(gappy.missingEmail).toBe(true);
    expect(gappy.missingPhone).toBe(true);
    expect(gappy.missingProperty).toBe(true);
    expect(gappy.missingSource).toBe(true);
    expect(gappy.unassigned).toBe(true);
    expect(gappy.incomplete).toBe(true);
  });
});

describe("row + summary builder", () => {
  it("buildLeadRows adds derived signals to every row", () => {
    const d = demo({ leadId: "lead-1", status: "confirmed" });
    const rows = buildLeadRows([lead()], [d], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: "lead-1",
        stale: false,
        followUpStatus: "none",
        demoStatus: "scheduled",
        converted: false,
        dealAgeDays: 10,
        daysInStage: 3,
      }),
    );
  });

  it("leadsKpis counts real stage/band/follow-up/age signals", () => {
    const now = Date.now();
    const rows = buildLeadRows(
      [
        lead({ id: "a", stage: "new", band: "cold", createdAt: new Date(now - DAY).toISOString() }),
        lead({ id: "b", stage: "qualified", band: "hot", nextFollowUpAt: new Date(now - 2 * DAY).toISOString() }),
        lead({ id: "c", stage: "won", band: "hot" }),
        lead({ id: "d", stage: "lost", band: "cold" }),
      ],
      [],
      [],
      now,
    );
    const k = leadsKpis(rows, now);
    expect(k.total).toBe(4);
    expect(k.newThisWeek).toBe(1);
    expect(k.qualified).toBe(1);
    expect(k.open).toBe(2);
    expect(k.hot).toBe(2);
    expect(k.overdueFollowUps).toBe(1);
    expect(k.won).toBe(1);
    expect(k.closedDeals).toBe(2);
    expect(k.conversionRate).toBe(50);
  });

  it("funnelOf lists only stages with leads, in pipeline order", () => {
    const rows = buildLeadRows(
      [lead({ id: "a", stage: "won" }), lead({ id: "b", stage: "new" }), lead({ id: "c", stage: "won" })],
      [],
      [],
    );
    const funnel = funnelOf(rows, PIPELINE_STAGES);
    const seen = funnel.map((f) => f.stage);
    expect(seen.indexOf("won") > seen.indexOf("new")).toBe(true);
    expect(funnel.find((f) => f.stage === "won")?.count).toBe(2);
    expect(funnel.find((f) => f.stage === "lost")).toBeUndefined();
  });

  it("openValueByCurrency never merges currencies and skips closed stages", () => {
    const rows = buildLeadRows(
      [
        lead({ id: "a", stage: "new", estimatedValue: 120_00, estimatedValueCurrency: "USD" }),
        lead({ id: "b", stage: "qualified", estimatedValue: 500_00, estimatedValueCurrency: "USD" }),
        lead({ id: "c", stage: "new", estimatedValue: 300_00, estimatedValueCurrency: "LKR" }),
        lead({ id: "d", stage: "won", estimatedValue: 999_00, estimatedValueCurrency: "USD" }),
      ],
      [],
      [],
    );
    const by = openValueByCurrency(rows);
    expect(by.find((x) => x.currency === "USD")?.value).toBe(620_00);
    expect(by.find((x) => x.currency === "LKR")?.value).toBe(300_00);
  });

  it("toLeadRow exposes population-grade field set for the table", () => {
    const row = toLeadRow(
      lead({ id: "lead-1", propertyName: "Harbor Inn", company: "Harbor Hotels", priority: "high" }),
      new Map([["lead-1", demo({ status: "completed" })]]),
      [],
    );
    expect(row.propertyName).toBe("Harbor Inn");
    expect(row.priority).toBe("high");
    expect(row.demoStatus).toBe("completed");
  });
});