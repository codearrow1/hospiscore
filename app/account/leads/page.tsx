import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy lead list retired (Phase 5) — /marketing-admin/leads is the single
 * CRM surface (pipeline, owners, follow-ups, conversion). The raw demo/report
 * captures this page used to show are mirrored into the marketing CRM at
 * ingestion time, so nothing is lost.
 */
export default function LegacyAccountLeadsPage() {
  redirect("/marketing-admin/leads");
}
