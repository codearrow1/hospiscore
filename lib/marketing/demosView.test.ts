import { describe, it, expect } from "vitest";
import {
  enrichDemo,
  isDemoActive,
  isoDay,
  startOfWeek,
  startsToday,
  startsThisWeek,
  startsUpcoming,
  slotEnd,
  demoNeedsFollowUp,
  demosKpis,
  periodKey,
  matchesFilters,
  sortDemos,
  paginate,
  conflictsFor,
} from "./demosView";
import type { DemoBooking, MarketingLead } from "./types";

const DAY = 86_400_000;

function booking(over: Partial<DemoBooking> = {}): DemoBooking {
  return {
    id: "demo-1",
    leadId: "lead-1",
    startAt: new Date(Date.now() + DAY).toISOString(),
    durationMin: 45,
    status: "confirmed",
    createdAt: new Date(Date.now() - DAY).toISOString(),
    updatedAt: new Date(Date.now() - DAY).toISOString(),
    ...over,
  };
}

function lead(over: Partial<MarketingLead> = {}): MarketingLead {
  return {
    id: "lead-1",
    name: "Marta",
    email: "m@harbor.com",
    source: "direct",
    score: 50,
    band: "hot",
    stage: "demo_booked",
    estimatedValue: 0,
    notes: [],
    attribution: {},
    createdAt: new Date(Date.now() - 10 * DAY).toISOString(),
    updatedAt: new Date(Date.now() - 3 * DAY).toISOString(),
    ...over,
  };
}

describe("enrichDemo", () => {
  it("joins lead context and owner/affiliate names", () => {
    const row = enrichDemo(
      booking({ demoType: "product walkthrough" }),
      lead({ company: "Casa Vista", propertyName: "Villa A", country: "ES", rooms: 12, priority: "high", estimatedValue: 12000 }),
      { ownerName: "Ada", affiliateName: "Partner Co" },
    );
    expect(row.leadName).toBe("Marta");
    expect(row.demoType).toBe("product walkthrough");
    expect(row.leadCompany).toBe("Casa Vista");
    expect(row.leadProperty).toBe("Villa A");
    expect(row.assignedTo).toBeUndefined();
    expect(row.ownerName).toBe("Ada");
    expect(row.affiliateName).toBe("Partner Co");
  });

  it("defaults a missing lead to an honest unknown", () => {
    const row = enrichDemo(booking(), null);
    expect(row.leadName).toBe("Unknown lead");
    expect(row.leadEmail).toBe("");
    expect(row.leadStage).toBe("new");
  });
});

describe("period helpers", () => {
  const now = new Date(2026, 2, 4); // Wednesday
  it("isoDay matches local calendar day", () => {
    expect(isoDay(now)).toBe("2026-03-04");
  });
  it("startOfWeek is Monday", () => {
    const monday = startOfWeek(now);
    expect(monday.getDay()).toBe(1);
    expect(monday.toDateString()).toBe(new Date(2026, 2, 2).toDateString());
  });
  it("classifies today / this week / upcoming / past", () => {
    const today = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const saturday = new Date(2026, 2, 7, 10).toISOString(); // same week
    const nextMon = new Date(2026, 2, 9, 10).toISOString(); // next week
    const lastWeek = new Date(2026, 1, 25, 10).toISOString();
    expect(startsToday(today, now)).toBe(true);
    expect(startsThisWeek(saturday, now)).toBe(true);
    expect(startsThisWeek(nextMon, now)).toBe(false);
    expect(startsUpcoming(today, now)).toBe(true);
    expect(startsUpcoming(lastWeek, now)).toBe(false);
    expect(periodKey({ startAt: today, status: "confirm" as never }, now)).toBe("today");
    expect(periodKey({ startAt: saturday, status: "confirm" as never }, now)).toBe("week");
    expect(periodKey({ startAt: nextMon, status: "confirm" as never }, now)).toBe("upcoming");
    expect(periodKey({ startAt: lastWeek, status: "confirm" as never }, now)).toBe("past");
  });
  it("slotEnd adds duration in minutes", () => {
    const start = new Date(2026, 2, 4, 10, 0).toISOString();
    expect(slotEnd(start, 45)).toBe(Date.parse(start) + 45 * 60 * 1000);
  });
});

describe("isDemoActive / demoNeedsFollowUp", () => {
  it("only live statuses are active", () => {
    expect(isDemoActive("new")).toBe(true);
    expect(isDemoActive("confirmed")).toBe(true);
    expect(isDemoActive("reschedule_requested")).toBe(true);
    expect(isDemoActive("completed")).toBe(false);
    expect(isDemoActive("no_show")).toBe(false);
    expect(isDemoActive("cancelled")).toBe(false);
    expect(isDemoActive("converted")).toBe(false);
  });

  it("flags completed demo on an open lead without a scheduled follow-up", () => {
    const now = new Date();
    const row = {
      startAt: new Date(now.getTime() - DAY).toISOString(),
      status: "completed" as const,
      leadStage: "demo_completed",
      convertedCustomerId: undefined,
      nextFollowUpAt: undefined,
    };
    expect(demoNeedsFollowUp(row, now)).toBe(true);
  });

  it("does not flag when a follow-up is scheduled in the future", () => {
    const now = new Date();
    const row = {
      startAt: new Date(now.getTime() - DAY).toISOString(),
      status: "no_show" as const,
      leadStage: "demo_completed",
      convertedCustomerId: undefined,
      nextFollowUpAt: new Date(now.getTime() + DAY).toISOString(),
    };
    expect(demoNeedsFollowUp(row, now)).toBe(false);
  });

  it("does not flag closed or long-ago demos", () => {
    const now = new Date();
    const closed = {
      startAt: new Date(now.getTime() - DAY).toISOString(),
      status: "completed" as const,
      leadStage: "won",
      convertedCustomerId: "c1",
      nextFollowUpAt: undefined,
    };
    expect(demoNeedsFollowUp(closed, now)).toBe(false);
    const old = {
      startAt: new Date(now.getTime() - 120 * DAY).toISOString(),
      status: "completed" as const,
      leadStage: "demo_completed",
      convertedCustomerId: undefined,
      nextFollowUpAt: undefined,
    };
    expect(demoNeedsFollowUp(old, now)).toBe(false);
  });
});

describe("demosKpis", () => {
  const now = new Date(2026, 2, 4, 10, 0, 0); // Wed 2026-03-04 10:00
  const at = (month: number, day: number, hour = 10) =>
    new Date(2026, month, day, hour, 0, 0).toISOString();
  const rows = [
    enrichDemo(booking({ id: "a", startAt: at(2, 4, 11), status: "confirmed" }), lead({ name: "A" })),
    enrichDemo(booking({ id: "b", startAt: at(2, 3), status: "completed" }), lead({ name: "B", stage: "won", convertedCustomerId: "c1", estimatedValue: 9000 })),
    enrichDemo(booking({ id: "c", startAt: at(2, 2), status: "completed" }), lead({ name: "C", stage: "trial", trialStartedAt: now.toISOString() })),
    enrichDemo(booking({ id: "d", startAt: at(2, 1), status: "no_show" }), lead({ name: "D" })),
    enrichDemo(booking({ id: "e", startAt: at(1, 28), status: "cancelled" }), lead({ name: "E" })),
    enrichDemo(booking({ id: "f", startAt: at(2, 4, 15), status: "new" }), lead({ name: "F" })),
  ];
  const k = demosKpis(rows, now);
  it("counts today / week / upcoming honestly", () => {
    expect(k.total).toBe(6);
    expect(k.today).toBe(2); // a + f on the same calendar day, neither cancelled
    expect(k.upcoming).toBe(2); // confirmed + new in the future
    expect(k.thisWeek).toBe(2);
  });
  it("tracks await-confirmation, follow-ups and outcomes", () => {
    expect(k.awaitingConfirmation).toBe(1);
    expect(k.noShow).toBe(1);
    expect(k.cancelled).toBe(1);
    expect(k.needsFollowUp).toBe(2); // c (completed) + d (no_show): open leads, no follow-up scheduled
    expect(k.toWon).toBe(1);
    expect(k.toTrial).toBe(2); // b converted + c in trial
  });
});

describe("matching + distance", () => {
  const now = new Date();
  const rows = [
    enrichDemo(
      booking({ id: "a", startAt: now.toISOString(), status: "confirmed", assignedTo: "ada@x.com", city: "Barcelona", country: "ES" }),
      lead({ name: "Marta", email: "m@h.com", source: "direct", stage: "demo_booked", attribution: { campaign: "summer" } }),
    ),
  ];
  it("filters by text and status", () => {
    const r = rows[0];
    expect(matchesFilters(r, { q: "marta" })).toBe(true);
    expect(matchesFilters(r, { q: "summer" })).toBe(true);
    expect(matchesFilters(r, { q: "nope" })).toBe(false);
    expect(matchesFilters(r, { status: "cancelled" })).toBe(false);
    expect(matchesFilters(r, { status: "confirmed" })).toBe(true);
  });
  it("paginates and sorts", () => {
    const list = [rows[0]];
    expect(paginate(list, 1, 10).length).toBe(1);
    expect(paginate(list, 2, 10).length).toBe(0);
    const sorted = sortDemos(rows, "value", "asc");
    expect(sorted[0].id).toBe("a");
  });
});

describe("conflictsFor", () => {
  const day = new Date(2026, 2, 4, 10, 0).toISOString();
  const rows = [
    enrichDemo(booking({ id: "a", startAt: day, durationMin: 60, status: "confirmed", assignedTo: "ada@x.com" }), lead({ name: "A" })),
    enrichDemo(booking({ id: "b", startAt: new Date(2026, 2, 4, 10, 30).toISOString(), status: "confirmed", assignedTo: "ada@x.com" }), lead({ name: "B" })),
    enrichDemo(booking({ id: "c", startAt: new Date(2026, 2, 4, 11, 30).toISOString(), status: "confirmed", assignedTo: "ada@x.com" }), lead({ name: "C" })),
    enrichDemo(booking({ id: "d", startAt: new Date(2026, 2, 4, 10, 0).toISOString(), status: "confirmed", assignedTo: "bob@x.com" }), lead({ name: "D" })),
    enrichDemo(booking({ id: "e", startAt: new Date(2026, 2, 4, 10, 0).toISOString(), status: "cancelled", assignedTo: "ada@x.com" }), lead({ name: "E" })),
  ];
  it("flags same-assignee overlaps and ignores others", () => {
    const cand = { id: "x", assignedTo: "ada@x.com", startAt: new Date(2026, 2, 4, 10, 15).toISOString(), durationMin: 30 };
    const ids = conflictsFor(rows, cand).map((r) => r.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });
  it("treats unassigned demos as their own bucket", () => {
    const unassigned = [
      enrichDemo(booking({ id: "u1", startAt: day, status: "confirmed" }), lead({ name: "A" })),
      enrichDemo(booking({ id: "u2", startAt: new Date(2026, 2, 4, 10, 30).toISOString(), status: "confirmed" }), lead({ name: "B" })),
    ];
    const cand = { id: "c", startAt: new Date(2026, 2, 4, 10, 5).toISOString(), durationMin: 30 };
    expect(conflictsFor(unassigned, cand).map((r) => r.id)).toEqual(["u1", "u2"]);
  });
  it("ignores cancelled demos that no longer occupy time", () => {
    const cand = { id: "x", assignedTo: "ada@x.com", startAt: new Date(2026, 2, 4, 10, 5).toISOString(), durationMin: 30 };
    expect(conflictsFor(rows, cand).some((r) => r.id === "e")).toBe(false);
  });
});