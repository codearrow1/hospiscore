import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { resolveAppRole, dashboardPathFor } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Role router: sends each signed-in user to their canonical dashboard. */
export default async function DashboardRouter() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/dashboard");
  const role = await resolveAppRole(user);
  redirect(dashboardPathFor(role));
}
