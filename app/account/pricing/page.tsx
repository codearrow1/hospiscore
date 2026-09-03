import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy pricing manager retired (Phase 5) — localized pricing lives in the
 * Marketing Command Center at /marketing-admin/pricing.
 */
export default function LegacyAccountPricingPage() {
  redirect("/marketing-admin/pricing");
}
