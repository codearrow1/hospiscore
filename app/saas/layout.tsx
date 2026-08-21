import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { canAccess, roleFor, ROLE_LABELS } from "@/lib/marketing/roles";
import AdminShell from "@/components/marketing-admin/AdminShell";
import GlobalSearch from "@/components/saas/GlobalSearch";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import type { AdminNavItem } from "@/components/marketing-admin/AdminShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAAS_NAV: AdminNavItem[] = [
  { href: "/saas", label: "Command Center", icon: "dashboard" },
  { href: "/saas/organizations", label: "Organizations", icon: "leads" },
  { href: "/saas/subscriptions", label: "Subscriptions", icon: "pipeline" },
  { href: "/saas/plans", label: "Plans", icon: "pricing" },
  { href: "/saas/billing", label: "Billing", icon: "analytics" },
  { href: "/saas/usage", label: "Usage", icon: "campaigns" },
  { href: "/saas/coupons", label: "Coupons", icon: "pricing" },
  { href: "/saas/support", label: "Support", icon: "audit" },
  { href: "/saas/affiliates", label: "Affiliates", icon: "forms" },
  { href: "/saas/partners", label: "Partners", icon: "forms" },
  { href: "/saas/franchise", label: "Franchise", icon: "pricing" },
  { href: "/saas/audit", label: "Audit", icon: "audit" },
  { href: "/marketing-admin", label: "Marketing", icon: "forms" },
];

export const metadata = {
  title: "SaaS Command Center · HospiOS",
  robots: { index: false, follow: false },
};

export default async function SaasLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/saas");
  if (!canAccess(user)) {
    return restrictedPanel(
      "SaaS Command Center",
      "This control plane is restricted to platform owners. Ask an administrator to grant you a platform role.",
    );
  }
  const role = roleFor(user);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email, roleLabel: role ? ROLE_LABELS[role] : null }}
      nav={SAAS_NAV}
    >
      <div className="mb-3 flex justify-end">
        <GlobalSearch />
      </div>
      {children}
    </AdminShell>
  );
}
