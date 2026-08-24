import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { hasSaasPerm } from "@/lib/saas/roles";
import { prisma } from "@/lib/prisma";
import { SectionCard, Badge, EmptyState } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPEN_STATUSES = ["open", "pending", "in_progress"];

/** Staff dashboard — internal support/operations queue. */
export default async function StaffDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/staff");
  // Backend-enforced: staff tier holds SUPPORT_VIEW; everyone else is out.
  if (!hasSaasPerm(user, "SUPPORT_VIEW")) redirect("/account?next=/staff");

  const tickets = await prisma.supportTicket.findMany({
    where: { status: { in: OPEN_STATUSES } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 25,
    include: { organization: { select: { businessName: true, legalName: true } } },
  });
  const mine = tickets.filter((t) => t.assigneeEmail === user.email);
  const breached = tickets.filter((t) => t.slaDueAt && t.slaDueAt.getTime() < Date.now());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Staff Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">Support &amp; operations queue</p>
          </div>
          <Badge>Operational scope</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Open tickets</p>
            <p className="mt-1 text-2xl font-semibold">{tickets.length}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Assigned to me</p>
            <p className="mt-1 text-2xl font-semibold">{mine.length}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">SLA breached</p>
            <p className="mt-1 text-2xl font-semibold">{breached.length}</p>
          </SectionCard>
        </div>

        <SectionCard title="Queue">
          {tickets.length === 0 ? (
            <EmptyState title="No open tickets." body="All clear." />
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {tickets.map((t) => {
                const overdue = t.slaDueAt && t.slaDueAt.getTime() < Date.now();
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{t.subject}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {t.organization.businessName || t.organization.legalName} · {t.category}
                        {t.assigneeEmail ? ` · ${t.assigneeEmail}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {overdue ? <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">SLA</Badge> : null}
                      <Badge>{t.priority}</Badge>
                      <Badge>{t.status.replace(/_/g, " ")}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
  );
}
