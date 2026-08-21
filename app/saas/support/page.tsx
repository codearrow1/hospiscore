import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listTickets } from "@/lib/saas/support";
import TicketsManager from "@/components/saas/TicketsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SupportPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Support", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SUPPORT_VIEW")) return restrictedPanel("Support", "SUPPORT_VIEW required.");
  const { items } = await listTickets({});
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="mt-1 text-sm text-zinc-500">SaaS customer tickets with SLA tracking (urgent 4h · high 8h · medium 24h · low 72h). Open tickets feed customer health.</p>
      </div>
      <TicketsManager initialTickets={items as never[]} canManage={hasSaasPerm(guard.user, "SUPPORT_MANAGE")} />
    </div>
  );
}
