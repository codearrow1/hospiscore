import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { NavIcon } from "@/components/shell/NavIcon";
import PortalBottomNav from "@/components/shell/PortalBottomNav";
import type { NavItem } from "@/components/shell/types";
import type { BottomNavItem } from "@/components/shell/PortalBottomNav";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getCurrentUser } from "@/lib/sessionCookie";
import {
  canAccess,
  hasCapability,
  roleFor,
  ROLE_LABELS,
} from "@/lib/marketing/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALL_NAV: (NavItem & { capability?: Parameters<typeof hasCapability>[1] })[] = [
  { href: "/marketing-admin", label: "Dashboard" },
  { href: "/marketing-admin/leads", label: "Leads", capability: "leads.read" },
  { href: "/marketing-admin/pipeline", label: "Pipeline", capability: "leads.read" },
  { href: "/marketing-admin/demos", label: "Demos", capability: "leads.read" },
  { href: "/marketing-admin/campaigns", label: "Campaigns", capability: "campaigns.manage" },
  { href: "/marketing-admin/forms", label: "Forms", capability: "forms.manage" },
  { href: "/marketing-admin/pricing", label: "Pricing", capability: "pricing.manage" },
  { href: "/marketing-admin/analytics", label: "Analytics", capability: "analytics.read" },
  { href: "/marketing-admin/audit", label: "Audit log", capability: "audit.read" },
  { href: "/marketing-admin/settings", label: "Settings", capability: "settings.manage" },
  { href: "/saas", label: "SaaS Control Plane" },
];

const MARKETING_BOTTOM_NAV: BottomNavItem[] = [
  { href: "/marketing-admin", label: "Home" },
  { href: "/marketing-admin/leads", label: "Leads" },
  { href: "/marketing-admin/pipeline", label: "Pipeline" },
  { href: "/marketing-admin/campaigns", label: "Campaigns" },
  { href: "/marketing-admin/settings", label: "Settings" },
];

const ICONS: Record<string, string> = {
  "/marketing-admin": "dashboard",
  "/marketing-admin/leads": "leads",
  "/marketing-admin/pipeline": "pipeline",
  "/marketing-admin/demos": "demos",
  "/marketing-admin/campaigns": "campaigns",
  "/marketing-admin/forms": "forms",
  "/marketing-admin/pricing": "pricing",
  "/marketing-admin/analytics": "analytics",
  "/marketing-admin/audit": "audit",
  "/marketing-admin/settings": "settings",
  "/saas": "pricing",
};

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
  const nav = ALL_NAV.filter(
    (n) => !n.capability || hasCapability(user, n.capability),
  ).map((n) => ({
    href: n.href,
    label: n.label,
    icon: <NavIcon name={ICONS[n.href] ?? "dashboard"} />,
  }));

  return (
    <AppShell
      plane={{ id: "growth", name: "HospiOS Growth" }}
      user={{
        name: user.name,
        email: user.email,
        roleLabel: role ? ROLE_LABELS[role] : "",
      }}
      nav={nav}
      leadSearch
      bottomNav={<PortalBottomNav items={MARKETING_BOTTOM_NAV} />}
    >
      {children}
    </AppShell>
  );
}
