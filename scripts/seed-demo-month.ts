/**
 * One-month launch demo seeder (RBAC merge spec §13).
 *
 * Generates ~30 days of realistic activity relative to the run date:
 * leads + pipeline events + campaigns (JSON plane), and organizations,
 * subscriptions, invoices, usage, tickets, affiliate clicks/commissions and a
 * payout (SaaS plane). Idempotent: skips when marker org exists unless --force.
 *
 * Run: npm run seed:demo-month   (reset: npm run seed:demo-month -- --force after manual cleanup)
 */
import { prisma } from "@/lib/prisma";
import { writeData } from "@/lib/db";
import { seedDefaultPlans } from "@/lib/saas/plans";
import { syncOrgMrr } from "@/lib/saas/subscriptions";
import { ensureDemoUsers, ensurePortalIdentities } from "@/lib/marketing/seed";
import type { Campaign, LeadEvent, MarketingLead } from "@/lib/marketing/types";
import { PIPELINE_STAGES } from "@/lib/marketing/types";

const FORCE = process.argv.includes("--force");
const DAY = 86_400_000;

let s = 20260821;
function rnd(): number {
  s = (s * 1664525 + 1013904223) % 4294967296;
  return s / 4294967296;
}
function int(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function at(dayOffset: number): Date {
  const d = new Date(Date.now() - 30 * DAY + dayOffset * DAY);
  d.setHours(int(8, 20), int(0, 59), int(0, 59), 0);
  return d;
}

const COMPANY_NAMES = [
  "Sunset Palms Resort", "Harbour View Inn", "The Alpine Lodge", "City Central Suites",
  "Lakeside Boutique Hotel", "Palm Grove Villas", "Metro Business Hotel", "Coral Bay Retreat",
  "Old Town Guesthouse", "Skyline Grand", "Riverbank Residency", "Desert Rose Resort",
];
const COUNTRIES = ["US", "GB", "IN", "AE", "SG", "DE", "AU"];
const SOURCES = ["organic", "demo_page", "campaign", "referral", "country_page", "blog"] as const;
const OWNERS = ["sales@hospios.demo", "salesmanager@hospios.demo", "marketing@hospios.demo"];

function stageFor(day: number): (typeof PIPELINE_STAGES)[number] {
  const r = rnd();
  if (day <= 7) return r < 0.45 ? "new" : r < 0.75 ? "contacted" : r < 0.9 ? "qualified" : "lost";
  if (day <= 15)
    return r < 0.2 ? "new" : r < 0.4 ? "contacted" : r < 0.6 ? "qualified" : r < 0.75 ? "demo_booked" : r < 0.85 ? "trial" : r < 0.93 ? "won" : "lost";
  if (day <= 23)
    return r < 0.15 ? "new" : r < 0.3 ? "contacted" : r < 0.5 ? "demo_booked" : r < 0.65 ? "demo_completed" : r < 0.8 ? "proposal" : r < 0.92 ? "won" : "lost";
  return r < 0.1 ? "new" : r < 0.25 ? "demo_booked" : r < 0.45 ? "trial" : r < 0.65 ? "negotiation" : r < 0.88 ? "won" : "lost";
}

function bandFor(stage: string): "cold" | "warm" | "hot" | "very_hot" {
  if (stage === "won") return "very_hot";
  if (["negotiation", "proposal", "trial"].includes(stage)) return "hot";
  if (["demo_completed", "demo_booked", "qualified"].includes(stage)) return "warm";
  return "cold";
}

async function main(): Promise<void> {
  const marker = await prisma.organization.findFirst({ where: { legalName: { startsWith: "Demo Month Org" } } });
  if (marker && !FORCE) {
    console.log("Demo month already seeded — skipping (use --force to reseed).");
    return;
  }

  await ensureDemoUsers();
  await ensurePortalIdentities();

  let planRows = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
  if (planRows.length === 0) {
    await seedDefaultPlans();
    planRows = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { email: "affiliate@hospios.demo" } });
  const partner = await prisma.partner.findUnique({ where: { email: "partner@hospios.demo" } });

  // ---- JSON plane: campaigns, leads, lead events -------------------------
  const campaigns: Campaign[] = [
    ["Launch — Search", "search", "launch-search", 250000],
    ["Launch — Social", "social", "launch-social", 180000],
    ["APAC Outreach", "content", "apac-outreach", 90000],
  ].map(([name, channel, utm, budget], i): Campaign => ({
    id: `camp-demo-${i + 1}`,
    name: name as string,
    channel: channel as string,
    utmCampaign: utm as string,
    status: i === 2 ? "paused" : "active",
    startAt: at(0).toISOString(),
    endAt: new Date(at(0).getTime() + 60 * DAY).toISOString(),
    budget: budget as number,
    createdAt: at(0).toISOString(),
    updatedAt: at(0).toISOString(),
  }));

  const leads: MarketingLead[] = [];
  const events: LeadEvent[] = [];
  for (let i = 0; i < 36; i++) {
    const day = Math.floor((i / 36) * 29) + 1;
    const created = at(day);
    const stage = stageFor(day);
    const company = COMPANY_NAMES[i % COMPANY_NAMES.length];
    const source = pick(SOURCES);
    const id = `lead-demo-${String(i + 1).padStart(2, "0")}`;
    leads.push({
      id,
      name: pick(["Ava", "Noah", "Priya", "Marco", "Elena", "Raj", "Sofia", "Liam"]) + " " + pick(["Kumar", "Rossi", "Chen", "Smith", "Garcia", "Okafor"]),
      email: `contact${i + 1}@${company.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
      company,
      propertyName: company,
      propertyType: pick(["hotel", "resort", "hostel", "boutique"]),
      city: pick(["Austin", "London", "Goa", "Dubai", "Singapore", "Berlin", "Sydney"]),
      country: pick(COUNTRIES),
      rooms: int(12, 220),
      currentPms: pick(["Excel sheets", "Legacy PMS", "Cloudbeds", "Opera", "None"]),
      planInterest: pick(["starter", "professional", "business", "enterprise"]),
      billingCycle: rnd() < 0.7 ? "monthly" : "yearly",
      source,
      attribution: { source, pagePath: source === "demo_page" ? "/demo" : "/", campaign: source === "campaign" ? pick(["launch-search", "launch-social"]) : undefined },
      stage,
      score: stage === "won" ? int(80, 100) : bandFor(stage) === "hot" ? int(60, 79) : bandFor(stage) === "warm" ? int(40, 59) : int(10, 39),
      band: bandFor(stage),
      ownerEmail: pick(OWNERS),
      notes: [],
      estimatedValue: pick([1200, 2400, 3600, 6000]),
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    });
    events.push({
      id: `${id}-ev-created`, leadId: id, type: "created", at: created.toISOString(),
      summary: "Lead captured", detail: `Source: ${source}`,
    });
    if (stage !== "new") {
      events.push({
        id: `${id}-ev-stage`, leadId: id, type: "stage_changed",
        at: new Date(created.getTime() + int(1, 5) * DAY).toISOString(),
        byEmail: OWNERS[i % OWNERS.length], summary: `Moved to ${stage}`,
      });
    }
  }
  await writeData((d) => ({
    ...d,
    campaigns: [...(d.campaigns ?? []).filter((c) => !c.id.startsWith("camp-demo-")), ...campaigns],
    leads: [...(d.leads ?? []).filter((l) => !l.id.startsWith("lead-demo-")), ...leads],
    leadEvents: [...(d.leadEvents ?? []).filter((e) => !e.id.startsWith("lead-demo-")), ...events],
  }));

  // ---- SaaS plane: orgs, subscriptions, invoices, usage, tickets --------
  const now = new Date();
  let planIdx = 0;
  for (let i = 1; i <= 8; i++) {
    const day = Math.min(2 + Math.floor((i - 1) * 3.5), 28);
    const created = at(day);
    const plan = planRows[planIdx++ % planRows.length];
    const referredByPartner = i % 3 === 0 && partner;
    const referredByAffiliate = i % 4 === 1 && affiliate;
    const org = await prisma.organization.create({
      data: {
        legalName: `Demo Month Org ${String(i).padStart(2, "0")} — ${COMPANY_NAMES[(i - 1) % COMPANY_NAMES.length]}`,
        businessName: COMPANY_NAMES[(i - 1) % COMPANY_NAMES.length],
        country: pick(COUNTRIES),
        industry: "hospitality",
        status: "active",
        healthScore: int(55, 95),
        healthStatus: pick(["Healthy", "Healthy", "Stable", "AtRisk"]),
        acquisitionSource: referredByPartner ? "partner" : referredByAffiliate ? "affiliate" : pick(["organic", "campaign", "demo_page"]),
        acquisitionCampaign: pick(["launch-search", "launch-social", null]),
        partnerId: referredByPartner ? partner!.id : null,
        affiliateId: referredByAffiliate ? affiliate!.id : null,
      },
    });
    const periodStart = created;
    const sub = await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: "active",
        billingCycle: "monthly",
        mrr: plan.monthlyPrice,
        quantity: 1,
        currentPeriodStart: periodStart,
        currentPeriodEnd: new Date(periodStart.getTime() + 30 * DAY),
      },
    });
    const paidAt = new Date(created.getTime() + 2 * DAY);
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        subscriptionId: sub.id,
        type: "subscription",
        status: "paid",
        amount: plan.monthlyPrice,
        dueAt: new Date(created.getTime() + 7 * DAY),
        paidAt,
      },
    });
    await prisma.payment.create({
      data: {
        organizationId: org.id,
        invoiceId: invoice.id,
        gateway: "manual",
        amount: plan.monthlyPrice,
        status: "succeeded",
        createdAt: paidAt,
      },
    });
    await syncOrgMrr(org.id);
    const weeks = Math.max(1, Math.floor((now.getTime() - created.getTime()) / (7 * DAY)));
    for (let w = 0; w < weeks; w++) {
      const recDate = new Date(created.getTime() + w * 7 * DAY);
      if (recDate > now) break;
      const period = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, "0")}`;
      await prisma.usageRecord.create({
        data: { organizationId: org.id, metric: "properties", quantity: int(10, 60), period, recordedAt: recDate },
      });
      await prisma.usageRecord.create({
        data: { organizationId: org.id, metric: "bookings", quantity: int(80, 900), period, recordedAt: recDate },
      });
      await prisma.usageRecord.create({
        data: { organizationId: org.id, metric: "api_calls", quantity: int(2000, 40000), period, recordedAt: recDate },
      });
    }
    if (referredByPartner && partner) {
      await prisma.affiliateCommission.create({
        data: {
          partnerId: partner.id,
          organizationId: org.id,
          subscriptionId: sub.id,
          amount: Math.round(plan.monthlyPrice * 1.5),
          model: "percent_first",
          status: "approved",
        },
      });
    }
    if (referredByAffiliate && affiliate) {
      await prisma.affiliateCommission.create({
        data: {
          affiliateId: affiliate.id,
          organizationId: org.id,
          subscriptionId: sub.id,
          amount: Math.round(plan.monthlyPrice * 0.2),
          model: "percent_mrr_12",
          status: "payable",
        },
      });
    }
    // Backdate SaaS-plane timestamps to the demo timeline.
    await prisma.organization.update({ where: { id: org.id }, data: { createdAt: created, updatedAt: created } });
    await prisma.subscription.update({ where: { id: sub.id }, data: { createdAt: created, updatedAt: created } });
  }

  if (affiliate) {
    for (let c = 0; c < 80; c++) {
      await prisma.affiliateClick.create({
        data: {
          affiliateId: affiliate.id,
          utmSource: "newsletter",
          utmMedium: "referral",
          utmCampaign: "launch",
          createdAt: at(int(1, 29)),
        },
      });
    }
    const payable = await prisma.affiliateCommission.aggregate({
      where: { affiliateId: affiliate.id, status: "payable" },
      _sum: { amount: true },
    });
    if ((payable._sum.amount ?? 0) > 0) {
      await prisma.affiliatePayout.create({
        data: {
          affiliateId: affiliate.id,
          amount: payable._sum.amount!,
          method: "paypal",
          status: "approved",
        },
      });
    }
  }

  const ticketOrgs = await prisma.organization.findMany({
    where: { legalName: { startsWith: "Demo Month Org" } },
    take: 6,
  });

  // Give the customer-portal demo org (Demo Grand Hotel) its own usage trail.
  const portalOrg = await prisma.organization.findFirst({
    where: { contacts: { some: { email: "customer@hospios.demo" } } },
  });
  if (portalOrg && (await prisma.usageRecord.count({ where: { organizationId: portalOrg.id } })) === 0) {
    for (let w = 0; w < 4; w++) {
      const recDate = at(2 + w * 7);
      const period = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, "0")}`;
      await prisma.usageRecord.create({
        data: { organizationId: portalOrg.id, metric: "properties", quantity: int(18, 34), period, recordedAt: recDate },
      });
      await prisma.usageRecord.create({
        data: { organizationId: portalOrg.id, metric: "bookings", quantity: int(120, 640), period, recordedAt: recDate },
      });
      await prisma.usageRecord.create({
        data: { organizationId: portalOrg.id, metric: "api_calls", quantity: int(4000, 26000), period, recordedAt: recDate },
      });
    }
  }
  const ticketSpecs = [
    ["onboarding", "high", "in_progress", "Import rooms & rate plans"],
    ["technical", "urgent", "open", "Channel manager sync failing"],
    ["billing", "medium", "resolved", "Invoice VAT question"],
    ["subscription", "low", "open", "Upgrade enquiry — business plan"],
    ["integration", "medium", "pending", "Booking engine webhook setup"],
    ["account", "low", "closed", "Add secondary contact"],
  ] as const;
  for (let t = 0; t < ticketOrgs.length; t++) {
    const [category, priority, status, subject] = ticketSpecs[t];
    const created = at(int(5, 27));
    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: ticketOrgs[t].id,
        category,
        priority,
        status,
        subject,
        description: `${subject} — raised via demo activity.`,
        requesterEmail: "customer@hospios.demo",
        assigneeEmail: t % 2 === 0 ? "staff@hospios.demo" : null,
        slaDueAt: new Date(created.getTime() + (priority === "urgent" ? 4 : priority === "high" ? 8 : 24) * 3600_000),
        resolvedAt: status === "resolved" || status === "closed" ? new Date(created.getTime() + 12 * 3600_000) : null,
      },
    });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { createdAt: created, updatedAt: created } });
  }

  console.log("Demo month seeded:");
  console.log(`  campaigns=${campaigns.length} leads=${leads.length} events=${events.length}`);
  const counts = await Promise.all([
    prisma.organization.count({ where: { legalName: { startsWith: "Demo Month Org" } } }),
    prisma.subscription.count({ where: { organization: { legalName: { startsWith: "Demo Month Org" } } } }),
    prisma.invoice.count({ where: { organization: { legalName: { startsWith: "Demo Month Org" } } } }),
    prisma.supportTicket.count(),
    prisma.affiliateCommission.count(),
    prisma.affiliateClick.count(),
  ]);
  console.log(`  orgs=${counts[0]} subs=${counts[1]} invoices=${counts[2]} tickets=${counts[3]} commissions=${counts[4]} clicks=${counts[5]}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
