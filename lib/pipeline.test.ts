import { describe, it, expect } from "vitest";
import {
  toPipelineDeal,
  buildViewModel,
  applyPipelineFilters,
  emptyFilters,
  sortPipelineDeals,
  groupByStage,
  stageTotals,
  winRateOf,
  wonThisMonth,
  stageWinWeights,
  pipelineKpis,
  activeFilterCount,
  isStale,
  followUpStatusOf,
  isDemoLeadId,
  parseCsv,
  parseLeadsCsv,
} from "./marketing/pipeline";
import type { MarketingLead } from "./marketing/types";

const DAY = 86_400_000;

function lead(over: Partial<MarketingLead>): MarketingLead {
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

const names = new Map<string, string>([["rep@hospios.app", "Rep One"]]);

// ------------------------------------------------------------------ stale --

describe("stale & follow-up derivation", () => {
  it("flags stale when untouched for 14+ days", () => {
    const now = Date.now();
    expect(isStale(new Date(now - 15 * DAY).toISOString(), new Date(now - 15 * DAY).toISOString(), now)).toBe(true);
    expect(isStale(new Date(now - 10 * DAY).toISOString(), new Date(now - 10 * DAY).toISOString(), now)).toBe(false);
    expect(isStale(new Date(now - 20 * DAY).toISOString(), new Date(now - 3 * DAY).toISOString(), now)).toBe(false);
  });

  it("derives follow-up status from the real scheduled date only", () => {
    const now = Date.now();
    expect(followUpStatusOf(undefined, now).status).toBe("none");
    expect(followUpStatusOf(new Date(now - DAY).toISOString(), now).status).toBe("overdue");
    expect(followUpStatusOf(new Date(now + 2 * DAY).toISOString(), now).status).toBe("due");
    expect(followUpStatusOf(new Date(now + 20 * DAY).toISOString(), now).status).toBe("later");
  });
});

// -------------------------------------------------------------- view model --

describe("view model", () => {
  it("maps owners by lower-cased email and detects demo ids", () => {
    const d = toPipelineDeal(lead({ ownerEmail: "rep@hospios.app" }), names, Date.now());
    expect(d.ownerName).toBe("Rep One");
    expect(isDemoLeadId("lead-demo-xyz")).toBe(true);
    expect(isDemoLeadId("lead-1")).toBe(false);
  });

  it("derives staleness, days-in-stage and currency uppercasing", () => {
    const now = Date.now();
    const d = toPipelineDeal(
      lead({ stage: "qualified", updatedAt: new Date(now - 16 * DAY).toISOString(), estimatedValue: 50000, estimatedValueCurrency: "inr" }),
      names,
      now,
    );
    expect(d.stale).toBe(true);
    expect(d.daysInStage).toBe(16);
    expect(d.estimatedValueCurrency).toBe("inr"); // kept as-is from record; grouping uppercases
  });
});

// ---------------------------------------------------------------- filters --

describe("pipeline filters", () => {
  const deals = buildViewModel(
    [
      lead({ id: "a", name: "Agora", ownerEmail: "rep@hospios.app", stage: "qualified", priority: "high", estimatedValue: 100000, updatedAt: new Date(Date.now() - 15 * DAY).toISOString() }),
      lead({ id: "b", name: "Boulder", ownerEmail: "sue@x.com", stage: "new", priority: "low", estimatedValue: 5000 }),
      lead({ id: "lead-demo-1", name: "Demo", stage: "contacted", score: 60 }),
    ],
    { users: [{ email: "rep@hospios.app", name: "Rep" }] },
  );

  it("filters by owner email, none, priority and stage", () => {
    const f = emptyFilters();
    f.owner = "rep@hospios.app";
    expect(applyPipelineFilters(deals, f).map((d) => d.id)).toEqual(["a"]);

    f.owner = "sue@x.com";
    expect(applyPipelineFilters(deals, f).map((d) => d.id)).toEqual(["b"]);

    f.owner = "__none__";
    expect(applyPipelineFilters(deals, f).map((d) => d.id)).toEqual(["lead-demo-1"]);

    f.owner = "rep@hospios.app";
    f.priority = "high";
    expect(applyPipelineFilters(deals, f).map((d) => d.id)).toEqual(["a"]);
  });

  it("excludes demo records when filtered and includes otherwise", () => {
    const f = emptyFilters();
    f.demoExcluded = true;
    expect(applyPipelineFilters(deals, f).map((d) => d.id)).toEqual(["a", "b"]);
    f.demoExcluded = false;
    expect(applyPipelineFilters(deals, f)).toHaveLength(3);
  });

  it("filters by stale status", () => {
    const f = emptyFilters();
    f.staleOnly = true;
    expect(applyPipelineFilters(deals, f).map((d) => d.id)).toEqual(["a"]);
  });

  it("counts active non-default filters", () => {
    const f = emptyFilters();
    expect(activeFilterCount(f)).toBe(0);
    f.staleOnly = true;
    f.owner = "x";
    expect(activeFilterCount(f)).toBe(2);
  });
});

// -------------------------------------------------------------- grouping ---

describe("grouping & totals", () => {
  const deals = buildViewModel(
    [
      lead({ id: "a", stage: "qualified", estimatedValue: 1200, estimatedValueCurrency: "usd" }),
      lead({ id: "b", stage: "qualified", estimatedValue: 900 }),
      lead({ id: "c", stage: "won" }),
    ],
    {},
  );

  it("groups by stage and totals per currency without merging", () => {
    const byStage = groupByStage(deals);
    expect(byStage.qualified.map((d) => d.id)).toEqual(["a", "b"]);
    const totals = stageTotals(deals);
    expect(totals.qualified.count).toBe(2);
    expect(totals.qualified.byCurrency.USD).toBe(2100);
  });

  it("computes win rate only from closed deals", () => {
    expect(winRateOf(deals)).toEqual({ rate: 100, closed: 1 });
    const noClosed = buildViewModel([lead({ id: "x", stage: "new" })], {});
    expect(winRateOf(noClosed)).toEqual({ rate: null, closed: 0 });
  });
});

// ---------------------------------------------------------- win this month --

describe("won this month", () => {
  it("counts won records and converted customers in the current month", () => {
    const now = Date.now();
    const d = new Date(now);
    const thisMonth = new Date(d.getFullYear(), d.getMonth(), 15).toISOString();
    const lastMonth = new Date(d.getFullYear(), d.getMonth() - 1, 15).toISOString();
    const deals = buildViewModel(
      [
        lead({ id: "a", stage: "won", updatedAt: thisMonth }),
        lead({ id: "b", stage: "won", updatedAt: lastMonth }),
        lead({ id: "c", stage: "new", updatedAt: thisMonth }),
      ],
      {},
    );
    expect(wonThisMonth(deals, [thisMonth, lastMonth], now)).toBe(2);
  });
});

// ---------------------------------------------------------- weighted value --

describe("stage win weights (honest)", () => {
  it("returns no weights when there is no closed-deal evidence", () => {
    const events = [
      { id: "e1", leadId: "a", type: "stage_changed" as const, summary: "Moved from New to Contacted", at: new Date().toISOString() },
    ];
    const { weights, sample } = stageWinWeights([lead({ id: "a", stage: "new" })], events);
    expect(sample).toBe(0);
    expect(Object.keys(weights).length).toBe(0);
  });

  it("derives weights from real closed trajectories, resolving label summaries", () => {
    const leads = [
      lead({ id: "win1", stage: "won" }),
      lead({ id: "lost1", stage: "lost" }),
      lead({ id: "open1", stage: "contacted" }),
    ];
    const events = [
      // win1 reached qualified & proposal, then won
      { id: "e1", leadId: "win1", type: "stage_changed" as const, summary: "Moved from New to Qualified", at: "" },
      { id: "e2", leadId: "win1", type: "stage_changed" as const, summary: "Moved from Qualified to Proposal", at: "" },
      // lost1 reached qualified, then lost
      { id: "e3", leadId: "lost1", type: "stage_changed" as const, summary: "Moved from New to Qualified", at: "" },
    ];
    const { weights, sample } = stageWinWeights(leads, events);
    expect(sample).toBe(2);
    expect(weights.qualified).toBe(0.5);
    expect(weights.proposal).toBe(1);
    expect(weights.negotiation).toBeUndefined();
  });

  it("never fabricates a weight for stages without closed evidence", () => {
    const { weights } = stageWinWeights(
      [lead({ id: "w", stage: "won" })],
      [{ id: "e1", leadId: "w", type: "stage_changed" as const, summary: "Moved from New to Qualified", at: "" }],
    );
    expect(weights.qualified).toBe(1);
    expect(weights.demo_booked).toBeUndefined();
  });
});

// ------------------------------------------------------------------- kpis --

describe("pipeline KPIs", () => {
  it("computes value per currency and flags missing weight evidence", () => {
    const now = Date.now();
    const deals = buildViewModel(
      [
        lead({ id: "a", stage: "qualified", estimatedValue: 1000 }),
        lead({ id: "b", stage: "won" }),
      ],
      {},
    );
    const noWeights = pipelineKpis(deals, undefined, { now });
    expect(noWeights.open).toBe(1);
    expect(noWeights.valueByCurrency.USD).toBe(1000);
    expect(noWeights.weightedAvailable).toBe(false);
    expect(noWeights.winRate).toBe(100);

    const withWeights = pipelineKpis(deals, { qualified: 0.5 }, { now });
    expect(withWeights.weightedAvailable).toBe(true);
    expect(withWeights.weightedByCurrency.USD).toBe(500);
  });

  it("counts won this month and outcome totals", () => {
    const deals = buildViewModel(
      [
        lead({ id: "a", stage: "won" }),
        lead({ id: "b", stage: "lost" }),
      ],
      {},
    );
    const k = pipelineKpis(deals, undefined, { wonThisMonth: 3 });
    expect(k.outcomes.won).toBe(1);
    expect(k.outcomes.lost).toBe(1);
    expect(k.wonThisMonth).toBe(3);
  });
});

// --------------------------------------------------------------- sorting ---

describe("sort pipeline deals", () => {
  it("sorts by value and name tiebreak across directions", () => {
    const deals = buildViewModel(
      [
        lead({ id: "a", name: "Agora", estimatedValue: 100 }),
        lead({ id: "b", name: "Boulder", estimatedValue: 300 }),
        lead({ id: "c", name: "Calm", estimatedValue: 100 }),
      ],
      {},
    );
    const asc = sortPipelineDeals(deals, "value", "asc");
    expect(asc.map((d) => d.id)).toEqual(["a", "c", "b"]);
    const desc = sortPipelineDeals(deals, "value", "desc");
    expect(desc.map((d) => d.id)).toEqual(["b", "a", "c"]);
  });
});

// -------------------------------------------------------------------- CSV --

describe("CSV parsing", () => {
  it("splits lines handling BOM, quotes and CRLF", () => {
    const rows = parseCsv("\uFEFFname,email\r\n\"Ann \"\"A\"\" Lee\",a@b.com\r\nBob,b@c.com\r\n");
    expect(rows[0]).toEqual(["name", "email"]);
    expect(rows[1]).toEqual(['Ann "A" Lee', "a@b.com"]);
    expect(rows[2]).toEqual(["Bob", "b@c.com"]);
  });

  it("parses lead rows with header aliases, dropping invalid enums but keeping the row", () => {
    const res = parseLeadsCsv(
      "name,email,plan,stage,priority,estimatedValue,country\nHotel Rama,hello@rama.example,growth,qualified,high,120000,IN\nOther,,pro,garbage,urgent,,SE\n,,pro,,,,\n",
    );
    expect(res.headers).toContain("name");
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({
      name: "Hotel Rama",
      email: "hello@rama.example",
      planInterest: "growth",
      stage: "qualified",
      priority: "high",
      estimatedValue: 120000,
      country: "IN",
    });
    // invalid stage/priority values are dropped rather than fabricated
    expect(res.rows[1]).toMatchObject({ name: "Other", country: "SE" });
    expect(res.rows[1].stage).toBeUndefined();
    expect(res.rows[1].priority).toBeUndefined();
    // a row with no usable identity is skipped, not imported
    expect(res.skipped).toBe(1);
  });

  it("reports a missing header", () => {
    const res = parseLeadsCsv("foo,bar\n1,2\n");
    expect(res.error).toBeTruthy();
  });
});
