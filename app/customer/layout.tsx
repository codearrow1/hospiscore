import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { resolveAppRole } from "@/lib/rbac";
import { AppShell } from "@/components/shell/AppShell";
import { PORTAL_NAV, portalPlane } from "@/components/shell/portalNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/customer");
  const role = (await resolveAppRole(user)) ?? "customer";

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
