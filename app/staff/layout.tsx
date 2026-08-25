import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { hasSaasPerm } from "@/lib/saas/roles";
import { AppShell } from "@/components/shell/AppShell";
import { PORTAL_NAV, portalPlane } from "@/components/shell/portalNav";
import PortalBottomNav from "@/components/shell/PortalBottomNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/staff");
  // Backend-enforced: staff tier holds SUPPORT_VIEW; everyone else is out.
  if (!hasSaasPerm(user, "SUPPORT_VIEW")) redirect("/account?next=/staff");

  return (
    <AppShell
      plane={portalPlane("staff")}
      user={{ name: user.name, email: user.email, roleLabel: "support staff" }}
      nav={PORTAL_NAV.staff}
      bottomNav={<PortalBottomNav items={PORTAL_NAV.staff} />}
    >
      {children}
    </AppShell>
  );
}
