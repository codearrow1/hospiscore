import Link from "next/link";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import ProviderDetailClient from "@/components/saas/ProviderDetailClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Payment provider", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Payment provider", "SYSTEM_SETTINGS_MANAGE required.");
  }
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/saas/settings/payments" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            ← Payment providers
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Provider: {id}</h1>
        </div>
      </div>
      <ProviderDetailClient providerId={id} viewerEmail={guard.user.email} />
    </div>
  );
}
