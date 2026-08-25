import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { resolveAppRole } from "@/lib/rbac";
import { AppShell } from "@/components/shell/AppShell";
import { PORTAL_NAV, portalPlane } from "@/components/shell/portalNav";
import PortalBottomNav from "@/components/shell/PortalBottomNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/partner");
  const role = (await resolveAppRole(user)) ?? "partner";

  return (
    <AppShell
      plane={portalPlane(role)}
      user={{ name: user.name, email: user.email, roleLabel: role.replace(/_/g, " ") }}
      nav={PORTAL_NAV[role]}
      bottomNav={<PortalBottomNav items={PORTAL_NAV[role]} />}
    >
      {children}
    </AppShell>
  );
}
