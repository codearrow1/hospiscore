import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { getLead } from "@/lib/marketing/leads";
import { eventsForLead } from "@/lib/marketing/events";
import { listDemos } from "@/lib/marketing/demos";
import { listUsers } from "@/lib/marketing/users";
import { hasCapability } from "@/lib/marketing/roles";
import type { Capability } from "@/lib/marketing/roles";
import LeadWorkspace from "@/components/marketing-admin/LeadWorkspace";
import type {
  LeadDetailShape,
  EventLite,
  DemoLite,
} from "@/components/marketing-admin/LeadWorkspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALL_CAPS: Capability[] = [
  "access",
  "leads.read",
  "leads.write",
  "leads.manage",
  "demos.manage",
  "campaigns.manage",
  "forms.manage",
  "content.manage",
  "pricing.manage",
  "analytics.read",
  "settings.manage",
  "audit.read",
];

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) {
    return restrictedPanel("Lead detail", "You need leads.read permission to view leads.");
  }
  const { id } = await params;
  await ensureMarketingStore();

  const [lead, events, demos, team] = await Promise.all([
    getLead(id),
    eventsForLead(id),
    listDemos(),
    listUsers(),
  ]);

  if (!lead) notFound();

  const shape: LeadDetailShape = {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    propertyName: lead.propertyName,
    propertyType: lead.propertyType,
    city: lead.city,
    country: lead.country,
    rooms: lead.rooms,
    currentPms: lead.currentPms,
    planInterest: lead.planInterest,
    billingCycle: lead.billingCycle,
    message: lead.message,
    source: lead.source,
    attribution: lead.attribution ?? {},
    stage: lead.stage,
    score: lead.score,
    band: lead.band,
    ownerEmail: lead.ownerEmail,
    notes: lead.notes ?? [],
    nextFollowUpAt: lead.nextFollowUpAt,
    lastContactAt: lead.lastContactAt,
    estimatedValue: lead.estimatedValue,
    demoId: lead.demoId,
    lostReason: lead.lostReason,
    convertedCustomerId: lead.convertedCustomerId,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };

  const timeline: EventLite[] = events.map((e) => ({
    id: e.id,
    type: e.type,
    at: e.at,
    byEmail: e.byEmail,
    summary: e.summary,
    detail: e.detail,
  }));

  const leadDemos: DemoLite[] = demos
    .filter((d) => d.leadId === lead.id)
    .map((d) => ({
      id: d.id,
      leadId: d.leadId,
      startAt: d.startAt,
      durationMin: d.durationMin,
      status: d.status,
      assignedTo: d.assignedTo,
      meetingUrl: d.meetingUrl,
      notes: d.notes,
    }));

  const capabilities = ALL_CAPS.filter((c) => hasCapability(guard.user, c));

  return (
    <LeadWorkspace
      lead={shape}
      events={timeline}
      demos={leadDemos}
      team={team.map((t) => ({ id: t.id, name: t.name, email: t.email, role: t.role }))}
      capabilities={capabilities}
    />
  );
}