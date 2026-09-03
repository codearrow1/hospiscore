import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy /subadmin dashboard retired (Phase 5) — the Marketing Command Center
 * at /marketing-admin is the single Growth-plane home. The layout guard still
 * runs first, so only authorized subadmins reach this redirect.
 */
export default function SubadminDashboard() {
  redirect("/marketing-admin");
}
