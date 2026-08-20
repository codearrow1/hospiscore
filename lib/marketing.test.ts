import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeData, readData } from "./db";
import { roleFor, hasCapability, ROLE_CAPABILITIES } from "./marketing/roles";
import { canMove } from "./marketing/stages";
import { scoreLead, bandFor } from "./marketing/scoring";
import {
  findExisting,
  upsertLead,
  getLead,
  updateLead,
  moveStage,
  addNote,
  scheduleFollowUp,
  convertLead,
  filterLeads,
  leadToCsvRows,
} from "./marketing/leads";
import { eventsForLead } from "./marketing/events";
import { writeAudit, listAudit, countAudit } from "./marketing/audit";
import { getForm, validateFormFields, handleFormSubmission } from "./marketing/forms";
import { createDemo, updateDemo, demoReminders, listDemos } from "./marketing/demos";
import {
  createCampaign,
  listCampaigns,
  updateCampaign,
  leadInCampaign,
  campaignStats,
  totalPipelineValue,
} from "./marketing/campaigns";
import { cleanReferrer, cleanPath, validateTrackInput, recordView, viewCount } from "./marketing/track";
import { dashboardMetrics } from "./marketing/metrics";
import { ensureMarketingStore, ensureDemoUsers } from "./marketing/seed";

let dirs: string[] = [];

async function tempTarget(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hs-marketing-"));
  dirs.push(dir);
  return path.join(dir, "data.json");
}

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

// ---------------------------------------------------------------- roles --

describe("marketing roles", () => {
  it("relies on the stored role first", () => {
    expect(roleFor({ email: "x@hospios.app", role: "sales_rep" })).toBe("sales_rep");
    expect(roleFor({ email: "x@hospios.app", role: "analyst" })).toBe("analyst");
  });

  it("falls back to the legacy admin allowlist as super_admin", () => {
    expect(roleFor({ email: "Owner@Hospios.com", role: undefined }, ["owner@hospios.com"])).toBe("super_admin");
    expect(roleFor({ email: "guest@x.com", role: undefined }, ["owner@hospios.com"])).toBeNull();
  });

  it("ignores unknown stored roles and falls back to the allowlist", () => {
    expect(roleFor({ email: "owner@hospios.com", role: "made_up" as never }, ["owner@hospios.com"])).toBe("super_admin");
  });

  it("maps capabilities per role", () => {
    const caps = (r: string) => (ROLE_CAPABILITIES as Record<string, ReadonlySet<string>>)[r];
    const user = { email: "rep@hospios.app" as string, role: "sales_rep" as never };
    expect(hasCapability(user, "leads.read")).toBe(true);
    expect(hasCapability(user, "leads.write")).toBe(true);
    expect(hasCapability(user, "leads.manage")).toBe(false);
    expect(hasCapability(user, "settings.manage")).toBe(false);
    expect(hasCapability(user, "analytics.read")).toBe(false);
    // Analyst is read-only; content_editor can manage content but not leads.
    expect(hasCapability({ email: "a@x.com", role: "analyst" as never }, "leads.write")).toBe(false);
    expect(hasCapability({ email: "a@x.com", role: "analyst" as never }, "analytics.read")).toBe(true);
    expect(hasCapability({ email: "e@x.com", role: "content_editor" as never }, "content.manage")).toBe(true);
    expect(hasCapability({ email: "e@x.com", role: "content_editor" as never }, "leads.read")).toBe(false);
    expect(caps("super_admin").size).toBeGreaterThan(caps("sales_rep").size);
  });
});

// --------------------------------------------------------------- stages --

describe("pipeline stage transitions", () => {
  it("allows forward moves and one-step backwards", () => {
    expect(canMove("new", "qualified")).toBe(true);
    expect(canMove("qualified", "contacted")).toBe(true);
    expect(canMove("contacted", "demo_booked")).toBe(true);
    expect(canMove("demo_booked", "contacted")).toBe(true);
    expect(canMove("new", "lost")).toBe(false);
    expect(canMove("contacted", "new")).toBe(false);
    expect(canMove("trial", "new")).toBe(false);
    expect(canMove("trial", "qualified")).toBe(false);
  });

  it("treats won/lost as terminal except re-open", () => {
    expect(canMove("won", "new")).toBe(true);
    expect(canMove("won", "lost")).toBe(false);
    expect(canMove("won", "negotiation")).toBe(false);
    expect(canMove("lost", "qualified")).toBe(true);
    expect(canMove("lost", "won")).toBe(false);
  });

  it("requires qualifying stages before won, and never wins straight from new", () => {
    expect(canMove("new", "won")).toBe(false);
    expect(canMove("proposal", "won")).toBe(true);
    expect(canMove("negotiation", "won")).toBe(true);
  });
});

// --------------------------------------------------------------- scoring --

describe("lead scoring", () => {
  it("scores positive signals and penalizes missing phone", () => {
    const hot = scoreLead({ rooms: 60, company: "Zephyr Group", planInterest: "enterprise", email: "gm@zephyr.co" });
    expect(hot.score).toBeGreaterThanOrEqual(25);
    expect(bandFor(hot.score)).not.toBe("cold");

    const cold = scoreLead({ rooms: 4, email: "x@gmail.com" });
    expect(bandFor(cold.score)).toBe("cold");
    expect(cold.applied).toContain("no_phone");
  });

  it("maps scores to bands with defined thresholds", () => {
    expect(bandFor(5)).toBe("cold");
    expect(bandFor(20)).toBe("warm");
    expect(bandFor(40)).toBe("hot");
    expect(bandFor(70)).toBe("very_hot");
  });
});

// ----------------------------------------------------------------- leads --

describe("marketing leads", () => {
  it("dedupes by email on upsert and merges fields", async () => {
    const target = await tempTarget();
    const first = await upsertLead(
      { name: "Marta", email: "m@harbor.com", source: "demo_page", country: "IN", rooms: 30 },
      target,
    );
    expect(first).not.toBeNull();
    const again = await upsertLead(
      { name: "Marta R.", email: "M@Harbor.com", phone: "+91 90000 00000", source: "whatsapp" },
      target,
    );
    expect(again).not.toBeNull();
    expect(again!.id).toBe(first!.id);
    expect(again!.name).toBe("Marta R.");
    expect(again!.phone).toContain("90000");
    expect(again!.country).toBe("IN");

    const doc = await readData(target);
    expect(doc.leads).toHaveLength(1);
    const events = await eventsForLead(first!.id, target);
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("finds an existing lead by phone when the email differs", async () => {
    const target = await tempTarget();
    await upsertLead({ name: "A", email: "a@x.com", phone: "+91 99999 11111", source: "direct" }, target);
    const existing = (await readData(target)).leads![0];
    const match = findExisting([existing], {
      phone: "+91 99999 11111",
    });
    expect(match?.name).toBe("A");
  });

  it("moves stages, writes timeline events and rejects unknown leads", async () => {
    const target = await tempTarget();
    const lead = await upsertLead({ name: "A", email: "a@x.com", source: "direct" }, target);
    const moved = await moveStage(lead!.id, "contacted", { byEmail: "rep@hospios.app" }, target);
    expect(moved!.stage).toBe("contacted");

    const events = await eventsForLead(lead!.id, target);
    expect(events[0].type).toBe("stage_changed");
    expect(events[0].summary).toContain("New to Contacted");

    expect(await moveStage("nope", "qualified", {}, target)).toBeNull();
    const won = await moveStage(lead!.id, "won", {}, target);
    expect(won!.stage).toBe("won");
  });

  it("adds notes and schedules follow-ups", async () => {
    const target = await tempTarget();
    const lead = await upsertLead({ name: "A", email: "a@x.com", source: "direct" }, target);
    const noted = await addNote(lead!.id, "Wants a call on Tuesday", undefined, target);
    expect(noted!.notes.some((n) => n.includes("Wants a call"))).toBe(true);
    const fut = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await scheduleFollowUp(lead!.id, fut, undefined, target);
    expect(scheduled!.nextFollowUpAt).toBe(fut);
  });

  it("converts a lead to a customer preserving attribution", async () => {
    const target = await tempTarget();
    const lead = await upsertLead(
      { name: "A", email: "a@x.com", source: "campaign", country: "DE", planInterest: "professional", attribution: { campaign: "sale-q3" } },
      target,
    );
    const converted = await convertLead(
      lead!.id,
      { plan: "professional", billingCycle: "yearly", notes: "Signed on the phone", byEmail: "rep@hospios.app" },
      target,
    );
    expect(converted!.convertedCustomerId).toBeTruthy();
    const doc = await readData(target);
    expect(doc.convertedCustomers).toHaveLength(1);
    expect(doc.convertedCustomers![0]).toMatchObject({
      leadId: lead!.id,
      plan: "professional",
      billingCycle: "yearly",
      country: "DE",
    });
    expect(doc.convertedCustomers![0].estimatedValue).toBeGreaterThan(0);
    const events = await eventsForLead(lead!.id, target);
    expect(events[0].type).toBe("converted");
  });

  it("filters by stage, source, country and free text", async () => {
    const target = await tempTarget();
    await upsertLead({ name: "Marta", email: "m@harbor.com", source: "demo_page", country: "IN" }, target);
    await upsertLead({ name: "Jonas", email: "jonas@lighthouse.se", source: "organic", country: "SE" }, target);
    const all = (await readData(target)).leads ?? [];

    expect(filterLeads(all, { source: "organic" })).toHaveLength(1);
    expect(filterLeads(all, { country: "in" })).toHaveLength(1);
    expect(filterLeads(all, { q: "lighthouse" })).toHaveLength(1);
    expect(filterLeads(all, { q: "no-match" })).toHaveLength(0);
  });

  it("edits fields through updateLead", async () => {
    const target = await tempTarget();
    const lead = await upsertLead({ name: "A", email: "a@x.com", source: "direct" }, target);
    const updated = await updateLead(lead!.id, { rooms: 42, planInterest: "growth" }, undefined, target);
    expect(updated!.rooms).toBe(42);
    expect(updated!.planInterest).toBe("growth");
    expect(updated!.score).toBeGreaterThan(0);
  });

  it("exports CSV with BOM, headers and escaped values", async () => {
    const target = await tempTarget();
    await upsertLead({ name: 'Ann "A" Lee', email: "ann@x.com", source: "direct", country: "US" }, target);
    const leads = (await readData(target)).leads ?? [];
    const csv = leadToCsvRows(leads);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("createdAt,name,email,phone");
    expect(csv).toContain('"Ann ""A"" Lee"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

// ---------------------------------------------------------------- forms --

describe("marketing forms", () => {
  it("validates required fields, emails, phones and consent", async () => {
    const target = await tempTarget();
    await ensureMarketingStore(target);
    const form = await getForm("demo", target);
    expect(form).not.toBeNull();
    const valid = validateFormFields(
      form!,
      { name: "Marta", email: "m@harbor.com", consent: true, rooms: 12 },
    );
    expect(valid.ok).toBe(true);

    const missing = validateFormFields(form!, { email: "m@harbor.com", consent: true });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("required");

    const badEmail = validateFormFields(form!, { name: "X", email: "not-an-email", consent: true });
    expect(badEmail.ok).toBe(false);
    if (!badEmail.ok) expect(badEmail.error).toMatch(/email/i);

    const noConsent = validateFormFields(form!, { name: "X", email: "x@y.com" });
    expect(noConsent.ok).toBe(false);
  });

  it("handles a full submission: lead created, timeline event, audit written", async () => {
    const target = await tempTarget();
    await ensureMarketingStore(target);
    const res = await handleFormSubmission(
      "demo",
      { name: "Marta", email: "m@harbor.com", phone: "+55 11 99999 9999", consent: "true", message: "Interested in switching from our current PMS" },
      { campaign: "q4-summit", pagePath: "/pricing?plan=growth", country: "BR" },
      target,
    );
    expect(res.ok).toBe(true);
    expect(res.leadId).toBeTruthy();

    const doc = await readData(target);
    const lead = doc.leads!.find((l) => l.id === res.leadId);
    expect(lead).toBeTruthy();
    expect(lead!.source).toBe("demo_page");
    expect(lead!.attribution.campaign).toBe("q4-summit");
    expect(lead!.attribution.country).toBe("BR");
    const events = await eventsForLead(lead!.id, target);
    expect(events[0].type).toBe("created");

    const audit = await listAudit(10, target);
    expect(audit.length).toBe(0); // no meta.byEmail → no audit entry
  });

  it("rejects unknown slugs and honeypot submissions", async () => {
    const target = await tempTarget();
    await ensureMarketingStore(target);
    const unknown = await handleFormSubmission("nope", { name: "X", email: "x@y.com" }, {}, target);
    expect(unknown).toMatchObject({ ok: false, error: "Unknown form" });
    const bot = await handleFormSubmission("demo", { name: "X", email: "x@y.com", consent: true, __honey: "spam" }, {}, target);
    expect(bot).toMatchObject({ ok: false, error: "Submission rejected" });
  });
});

// ---------------------------------------------------------------- demos --

describe("demo bookings", () => {
  it("books a demo against a lead and advances the pipeline on completion", async () => {
    const target = await tempTarget();
    const lead = await upsertLead({ name: "Marta", email: "m@harbor.com", source: "demo_page" }, target);
    const demo = await createDemo(
      { leadId: lead!.id, startAt: new Date(Date.now() + 86_400_000).toISOString(), assignedTo: "rep@hospios.app" },
      "rep@hospios.app",
      target,
    );
    expect(demo).not.toBeNull();
    expect(demo!.status).toBe("new");
    expect(demo!.durationMin).toBe(45);

    const doc = await readData(target);
    expect(doc.leads!.find((l) => l.id === lead!.id)!.demoId).toBe(demo!.id);

    const completed = await updateDemo(demo!.id, { status: "completed" }, "rep@hospios.app", target);
    expect(completed!.status).toBe("completed");
    const leadAfter = await getLead(lead!.id, target);
    expect(leadAfter!.stage).toBe("demo_completed");
  });

  it("refuses to book a demo for a missing lead", async () => {
    const target = await tempTarget();
    const demo = await createDemo({ leadId: "nope", startAt: new Date().toISOString() }, undefined, target);
    expect(demo).toBeNull();
  });

  it("flags upcoming demos as reminders within 24h", async () => {
    const target = await tempTarget();
    const lead = await upsertLead({ name: "Marta", email: "m@harbor.com", source: "direct" }, target);
    await createDemo({ leadId: lead!.id, startAt: new Date(Date.now() + 3_600_000).toISOString() }, undefined, target);
    await createDemo({ leadId: lead!.id, startAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), status: "confirmed" }, undefined, target);
    const demos = await listDemos(target);
    expect(demos).toHaveLength(2);
    expect(demoReminders(demos)).toHaveLength(1);
  });
});

// ------------------------------------------------------------ campaigns --

describe("campaign attribution", () => {
  it("matches leads by UTM campaign and landing page", async () => {
    const target = await tempTarget();
    const campaign = await createCampaign(
      { name: "Q4 hoteliers", channel: "google_ads", utmCampaign: "q4-hotelier", landingPage: "/pricing" },
      target,
    );
    const campaignLead = await upsertLead(
      { name: "A", email: "a@one.com", source: "google_ads", attribution: { campaign: "q4-hotelier" } },
      target,
    );
    const landingLead = await upsertLead(
      { name: "B", email: "b@two.com", source: "organic", attribution: { pagePath: "/pricing?plan=growth" } },
      target,
    );
    const cLead = await upsertLead({ name: "C", email: "c@three.com", source: "direct" }, target);

    const [cA, cB, cC] = await Promise.all([
      getLead(campaignLead!.id, target),
      getLead(landingLead!.id, target),
      getLead(cLead!.id, target),
    ]);
    expect(leadInCampaign(cA!, campaign)).toBe(true);
    expect(leadInCampaign(cB!, campaign)).toBe(true);
    expect(leadInCampaign(cC!, campaign)).toBe(false);

    const stats = await campaignStats(undefined, target);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ name: "Q4 hoteliers", leads: 2 });
  });

  it("tracks status changes and computes pipeline value", async () => {
    const target = await tempTarget();
    await createCampaign({ name: "C1", channel: "linkedin", utmCampaign: "c1" }, target);
    const l1 = await upsertLead({ name: "A", email: "a@one.com", source: "linkedin", planInterest: "professional", attribution: { campaign: "c1" } }, target);
    const l2 = await upsertLead({ name: "B", email: "b@two.com", source: "linkedin", attribution: { campaign: "c1" } }, target);
    await moveStage(l1!.id, "won", {}, target);
    await moveStage(l2!.id, "lost", {}, target);

    const stats = await campaignStats(undefined, target);
    expect(stats).toHaveLength(1);
    expect(stats[0].leads).toBe(2);
    const leads = (await readData(target)).leads ?? [];
    expect(totalPipelineValue(leads)).toBe(0); // won + lost excluded
    await updateCampaign(stats[0].id, { status: "paused" }, target);
    expect((await listCampaigns(target))[0].status).toBe("paused");
  });
});

// --------------------------------------------------------------- track --

describe("page-view tracking", () => {
  it("cleans referrers without leaking query strings cross-origin", () => {
    expect(cleanReferrer("https://google.com/search?q=hotel")).toBe("google.com/search");
    expect(cleanReferrer("https://thebuddharice.online/pricing?plan=growth")).toBe("/pricing?plan=growth");
    expect(cleanReferrer("not a url")).toBeUndefined();
  });

  it("rejects non-site and private paths", () => {
    expect(cleanPath("/pricing")).toBe("/pricing");
    expect(cleanPath("pricing")).toBeNull();
    expect(cleanPath("/marketing-admin/leads")).toBeNull();
    expect(cleanPath("/account")).toBeNull();
    expect(cleanPath("/api/marketing/track")).toBeNull();
    expect(cleanPath("/property/place:xyz")).toBeNull();
  });

  it("validates input shape", () => {
    const valid = validateTrackInput({ path: "/pricing", session: "s1", referrer: "https://x.com/a", utmSource: "google", country: "br" });
    expect(valid).not.toBeNull();
    expect(valid!.country).toBe("BR");
    expect(valid!.referrer).toBe("x.com/a");
    expect(validateTrackInput({ path: "/account", session: "s1" })).toBeNull();
  });

  it("records views and dedupes same session+path within 30s", async () => {
    const target = await tempTarget();
    const input = { path: "/pricing", session: "abc", utmCampaign: "q4" };
    const first = await recordView(input, target);
    expect(first).not.toBeNull();
    const dup = await recordView(input, target);
    expect(dup).toBeNull();
    const other = await recordView({ ...input, session: "xyz" }, target);
    expect(other).not.toBeNull();
    expect(await viewCount(target)).toBe(2);
  });
});

// -------------------------------------------------------------- metrics --

describe("dashboard metrics", () => {
  it("computes KPIs, funnel, demosToday and 14-day trend from real data", async () => {
    const target = await tempTarget();
    await ensureMarketingStore(target);
    const lead = await upsertLead(
      { name: "Marta", email: "m@harbor.com", source: "demo_page", country: "IN", planInterest: "growth" },
      target,
    );
    await createDemo({ leadId: lead!.id, startAt: new Date(Date.now() + 3_600_000).toISOString() }, undefined, target);

    const m = await dashboardMetrics(target);
    const totals = (await readData(target)).leads!.length;
    expect(m.kpis.totalLeads).toBe(totals);
    expect(m.kpis.newLeadsToday).toBe(1);
    expect(m.kpis.demoRequests).toBe(1);
    expect(m.kpis.pipelineValue).toBeGreaterThan(0);
    expect(m.funnel.find((f) => f.stage === "new")!.count).toBe(1);
    expect(m.demosToday).toHaveLength(1);
    expect(m.trend).toHaveLength(14);
    expect(m.trend[13].leads).toBe(1);
    expect(m.sources[0]).toMatchObject({ key: "demo_page", count: 1 });
    expect(m.countries[0]).toMatchObject({ key: "IN", count: 1 });
    expect(m.recentEvents.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- audit --

describe("audit log", () => {
  it("writes, lists newest-first and counts", async () => {
    const target = await tempTarget();
    await writeAudit({ byEmail: "Rep@HospiOS.App", action: "lead.updated", entity: "lead", entityId: "1", detail: "x" }, target);
    await writeAudit({ byEmail: "rep@hospios.app", action: "demo.updated", entity: "demo" }, target);

    const entries = await listAudit(10, target);
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("demo.updated");
    expect(entries[1].byEmail).toBe("rep@hospios.app");
    expect(await countAudit(target)).toBe(2);
  });
});

// ----------------------------------------------------------------- seed --

describe("marketing seed", () => {
  it("migrates historical demo requests into leads exactly once", async () => {
    const target = await tempTarget();
    await writeData(
      (d) => ({
        ...d,
        demoRequests: [
          {
            id: "r1",
            name: "Marta",
            email: "m@harbor.com",
            company: "Coastal Group",
            propertyName: "Harbor Lights",
            propertyCount: 12,
            message: "Hi",
            plan: "growth",
            createdAt: new Date().toISOString(),
          },
        ],
      }),
      target,
    );

    await ensureMarketingStore(target);
    let doc = await readData(target);
    expect(doc.leads).toHaveLength(1);
    expect(doc.leads![0]).toMatchObject({ name: "Marta", email: "m@harbor.com", planInterest: "growth", rooms: 12 });
    expect(doc.leads![0].source).toBe("demo_page");
    expect(doc.forms!.length).toBeGreaterThan(0);

    // Second run must not duplicate or re-migrate.
    await ensureMarketingStore(target);
    doc = await readData(target);
    expect(doc.leads).toHaveLength(1);
  });

  it("creates demo accounts once and skips existing on re-run", async () => {
    const target = await tempTarget();
    const first = await ensureDemoUsers(target);
    expect(first.created).toHaveLength(6);
    const second = await ensureDemoUsers(target);
    expect(second.created).toHaveLength(0);
    expect(second.existing).toHaveLength(6);

    const { users } = await readData(target);
    expect(users.some((u) => u.email === "superadmin@hospios.demo" && u.role === "super_admin")).toBe(true);
    expect(users.some((u) => u.email === "analyst@hospios.demo" && u.role === "analyst")).toBe(true);
  });
});