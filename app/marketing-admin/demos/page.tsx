import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listDemos } from "@/lib/marketing/demos";
import { listLeads } from "@/lib/marketing/leads";
import { listUsers } from "@/lib/marketing/users";
import DemosCalendar from "@/components/marketing-admin/DemosCalendar";
import type { DemoCalendarRow, LeadLitePick } from "@/components/marketing-admin/DemosCalendar";

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
  const view = sp.view === "list" ? "list" : "week";
  const week = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? "") ? sp.week : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [demos, leads, team] = await Promise.all([listDemos(), listLeads(), listUsers()]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const rows: DemoCalendarRow[] = demos.map((d) => {
    const lead = leadById.get(d.leadId);
    return {
      id: d.id,
      leadId: d.leadId,
      leadName: lead?.name ?? "Unknown lead",
      leadEmail: lead?.email ?? "",
      startAt: d.startAt,
      durationMin: d.durationMin,
      status: d.status,
      assignedTo: d.assignedTo,
      meetingUrl: d.meetingUrl,
      notes: d.notes,
      phone: lead?.phone,
    };
  });

  const leadPicks: LeadLitePick[] = leads
    .filter((l) => !l.convertedCustomerId)
    .map((l) => ({ id: l.id, name: l.name, email: l.email }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demos</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Booked by sales or self-serve from the site demo forms. Change a status
          and the lead pipeline follows.
        </p>
      </div>
      <DemosCalendar
        demos={rows}
        team={team.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
        leads={leadPicks}
        view={view}
        weekStart={week}
        page={page}
      />
    </div>
  );
}