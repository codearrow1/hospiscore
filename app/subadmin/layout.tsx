import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { canAccess } from "@/lib/marketing/roles";
import { resolveAppRole } from "@/lib/rbac";
import { AppShell } from "@/components/shell/AppShell";
import { PORTAL_NAV, portalPlane } from "@/components/shell/portalNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SubadminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/subadmin");
  if (!canAccess(user)) redirect("/account?next=/subadmin");
  const role = (await resolveAppRole(user)) ?? "subadmin";

  return (
    <AppShell
      plane={portalPlane(role)}
      user={{ name: user.name, email: user.email, roleLabel: role.replace(/_/g, " ") }}
      nav={PORTAL_NAV[role]}
    >
      {children}
    </AppShell>
  );
}
