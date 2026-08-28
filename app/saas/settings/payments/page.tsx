import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import PaymentSettingsForm from "@/components/saas/PaymentSettingsForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PaymentSettingsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Payment providers", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Payment providers", "SYSTEM_SETTINGS_MANAGE required to configure payment providers.");
  }
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Payment providers</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Provider-agnostic payment platform. Configure providers, routing, fees, and credentials for gateway charges and
          webhooks. Secrets are encrypted at rest and never exposed after saving. Changes are audited and take effect
          immediately.
        </p>
      </div>
      <PaymentSettingsForm viewerEmail={guard.user.email} />
    </div>
  );
}
