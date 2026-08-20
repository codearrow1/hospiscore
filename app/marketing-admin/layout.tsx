import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminShell from "@/components/marketing-admin/AdminShell";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getCurrentUser } from "@/lib/sessionCookie";
import {
  canAccess,
  hasCapability,
  roleFor,
  ROLE_LABELS,
} from "@/lib/marketing/roles";
import type { AdminNavItem } from "@/components/marketing-admin/AdminShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALL_NAV: (AdminNavItem & { capability?: Parameters<typeof hasCapability>[1] })[] = [
  { href: "/marketing-admin", label: "Dashboard", icon: "dashboard" },
  { href: "/marketing-admin/leads", label: "Leads", icon: "leads", capability: "leads.read" },
  { href: "/marketing-admin/pipeline", label: "Pipeline", icon: "pipeline", capability: "leads.read" },
  { href: "/marketing-admin/demos", label: "Demos", icon: "demos", capability: "leads.read" },
  { href: "/marketing-admin/campaigns", label: "Campaigns", icon: "campaigns", capability: "campaigns.manage" },
  { href: "/marketing-admin/forms", label: "Forms", icon: "forms", capability: "forms.manage" },
  { href: "/marketing-admin/pricing", label: "Pricing", icon: "pricing", capability: "pricing.manage" },
  { href: "/marketing-admin/analytics", label: "Analytics", icon: "analytics", capability: "analytics.read" },
  { href: "/marketing-admin/audit", label: "Audit log", icon: "audit", capability: "audit.read" },
  { href: "/marketing-admin/settings", label: "Settings", icon: "settings", capability: "settings.manage" },
];

export const metadata = {
  title: "Marketing Command Center · HospiOS",
  robots: { index: false, follow: false },
};

export default async function MarketingAdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/marketing-admin");

  if (!canAccess(user)) {
    return restrictedPanel(
      "Marketing Command Center",
      "This area is restricted to the HospiOS marketing and sales team. If you should have access, sign in with a team account or ask an administrator to add your e-mail to ADMIN_EMAILS or assign you a marketing role.",
    );
  }

  const role = roleFor(user);
  const nav: AdminNavItem[] = ALL_NAV.filter(
    (n) => !n.capability || hasCapability(user, n.capability),
  ).map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        roleLabel: role ? ROLE_LABELS[role] : null,
      }}
      nav={nav}
    >
      {children}
    </AdminShell>
  );
}