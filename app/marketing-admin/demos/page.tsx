import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { hasCapability, canAccessLead } from "@/lib/marketing/roles";
import { listDemos, isDemoStatus } from "@/lib/marketing/demos";
import { listLeads } from "@/lib/marketing/leads";
import { listUsers } from "@/lib/marketing/users";
import { readData } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { DEMO_STATUSES, LEAD_SOURCES, PIPELINE_STAGES, type LeadEvent } from "@/lib/marketing/types";
import { STAGE_LABELS } from "@/lib/marketing/stages";
import {
  enrichDemo,
  filterDemos,
  sortDemos,
  demosKpis,
  type DemoRow,
} from "@/lib/marketing/demosView";
import { DemosWorkspace } from "@/components/marketing-admin/demos/DemosWorkspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DemosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) {
    return restrictedPanel("Demos", "You need leads.read permission to manage demo bookings.");
  }
  await ensureMarketingStore();

  const sp = await searchParams;
  const view = (["week", "list", "agenda"] as const).includes(sp.view as never)
    ? (sp.view as "week" | "list" | "agenda")
    : "week";
  const week = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? "") ? sp.week : undefined;
  const q = sp.q ?? "";
  const status = isDemoStatus(sp.status ?? "") ? (sp.status ?? "") : "";
  const owner = sp.owner ?? "";
  const period = ["today", "week", "upcoming", "past"].includes(sp.period ?? "")
    ? (sp.period ?? "")
    : "";
  const country = sp.country ?? "";
  const stage = PIPELINE_STAGES.includes(sp.stage as never) ? (sp.stage ?? "") : "";
  const source = LEAD_SOURCES.includes(sp.source as never) ? (sp.source ?? "") : "";
  const demoType = sp.demoType ?? "";
  const followUp = sp.followUp === "1";
  const sort = (["startAt", "createdAt", "lead", "status", "value"] as const).includes(sp.sort as never)
    ? (sp.sort as "startAt" | "createdAt" | "lead" | "status" | "value")
    : "startAt";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const perPageRaw = parseInt(sp.perPage ?? "20", 10) || 20;
  const perPage = [10, 20, 50].includes(perPageRaw) ? perPageRaw : 20;

  const [demos, leads, users] = await Promise.all([listDemos(), listLeads(), listUsers()]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  // Sales reps (no leads.manage) are hard-scoped to demos assigned to them or
  // on their own leads — mirroring GET /api/marketing/demos; URL filters can
  // never widen the set.
  const canManage = hasCapability(guard.user, "leads.manage");
  const scopedDemos = canManage
    ? demos
    : demos.filter((d) => {
        const lead = leadById.get(d.leadId);
        return (
          (d.assignedTo ?? "").toLowerCase() === guard.user.email.toLowerCase() ||
          (!!lead && canAccessLead(guard.user, lead))
        );
      });

  // Real affiliate attribution: marketing-plan leads may have commissions
  // recorded in the SaaS plane (join by leadId). Best-effort; a failure must
  // never break the demos page.
  let affiliateByLead = new Map<string, string>();
  try {
    const scopedLeadIds = Array.from(new Set(scopedDemos.map((d) => d.leadId)));
    if (scopedLeadIds.length > 0) {
      const commissions = await prisma.affiliateCommission.findMany({
        where: { leadId: { in: scopedLeadIds } },
        select: { leadId: true, affiliateId: true },
      });
      const affiliateIds = Array.from(new Set(commissions.map((c) => c.affiliateId).filter(Boolean) as string[]));
      const affiliates = affiliateIds.length
        ? await prisma.affiliate.findMany({ where: { id: { in: affiliateIds } }, select: { id: true, name: true } })
        : [];
      const nameById = new Map(affiliates.map((a) => [a.id, a.name]));
      for (const c of commissions) {
        const affId = c.affiliateId;
        const leadId = c.leadId;
        if (!affId || !leadId) continue;
        affiliateByLead.set(leadId, nameById.get(affId) ?? affId);
      }
    }
  } catch {
    affiliateByLead = new Map<string, string>();
  }

  // Lead activity timeline for the detail drawer — bounded to the scoped demo
  // lead set, newest first (single read of the event log).
  const data = await readData();
  const demoLeadIds = new Set(scopedDemos.map((d) => d.leadId));
  let eventsByLead: Record<string, LeadEvent[]> = {};
  if (demoLeadIds.size > 0) {
    const map = new Map<string, LeadEvent[]>();
    for (const e of data.leadEvents ?? []) {
      if (!demoLeadIds.has(e.leadId)) continue;
      const list = map.get(e.leadId) ?? (map.set(e.leadId, []).get(e.leadId)!);
      list.push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (list.length > 30) list.length = 30;
    }
    eventsByLead = Object.fromEntries(map);
  }

  const rows: DemoRow[] = scopedDemos.map((d) => {
    const lead = leadById.get(d.leadId);
    const assignee = userByEmail.get((d.assignedTo ?? "").toLowerCase());
    return enrichDemo(d, lead, {
      ownerName: assignee?.name,
      affiliateName: d.leadId ? affiliateByLead.get(d.leadId) : undefined,
    });
  });

  const filtered = filterDemos(rows, { q, status, owner, period, country, stage, source, demoType, followUp });
  const sorted = sortDemos(filtered, sort, dir);
  const kpis = demosKpis(sorted, new Date());
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);

  const ownerOptions = users.map((u) => ({ email: u.email, name: u.name }));
  const statuses = DEMO_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }));
  const periods = [
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past" },
  ];
  const stageOptions = PIPELINE_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));
  const activeSources = LEAD_SOURCES.filter((s) => rows.some((r) => r.leadSource === s));
  const countryOptions = Array.from(
    new Set(rows.map((r) => r.country || r.city).filter(Boolean) as string[]),
  ).sort();
  const demoTypeOptions = Array.from(new Set(rows.map((r) => r.demoType).filter(Boolean) as string[])).sort();
  const leadPicks = leads
    .filter((l) => !l.convertedCustomerId)
    .map((l) => ({ id: l.id, name: l.name, email: l.email }));

  return (
    <DemosWorkspace
      demos={sorted}
      kpis={kpis}
      page={safePage}
      perPage={perPage}
      sort={sort}
      dir={dir}
      view={view}
      weekStart={week}
      team={users.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
      leads={leadPicks}
      eventsByLead={eventsByLead}
      rowsCount={rows.length}
      currentFilters={{ q, status, owner, period, country, stage, source, demoType, followUp: followUp ? "1" : "" }}
      options={{ ownerOptions, statuses, periods, stageOptions, sourceOptions: activeSources, countryOptions, demoTypeOptions }}
    />
  );
}