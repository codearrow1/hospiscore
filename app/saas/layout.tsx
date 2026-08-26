import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { canAccess, roleFor, ROLE_LABELS } from "@/lib/marketing/roles";
import { hasSaasPerm } from "@/lib/saas/roles";
import type { SaasPermission } from "@/lib/saas/roles";
import { initSaasDb } from "@/lib/saas/init";
import { AppShell } from "@/components/shell/AppShell";
import { NavIcon } from "@/components/shell/NavIcon";
import type { NavItem, QuickAction } from "@/components/shell/types";
import { restrictedPanel } from "@/app/marketing-admin/restricted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAAS_NAV: (NavItem & { perm?: SaasPermission })[] = [
  { href: "/saas", label: "Command Center" },
  { href: "/saas/organizations", label: "Organizations", perm: "CUSTOMER_VIEW" },
  { href: "/saas/subscriptions", label: "Subscriptions", perm: "SUBSCRIPTION_VIEW" },
  { href: "/saas/plans", label: "Plans", perm: "PLAN_VIEW" },
  { href: "/saas/plan-approvals", label: "Plan Approvals", perm: "SYSTEM_SETTINGS_MANAGE" },
  { href: "/saas/settings", label: "Settings", perm: "SYSTEM_SETTINGS_MANAGE" },
  { href: "/saas/billing", label: "Billing", perm: "BILLING_VIEW" },
  { href: "/saas/usage", label: "Usage", perm: "USAGE_VIEW" },
  { href: "/saas/coupons", label: "Coupons", perm: "MARKETING_VIEW" },
  { href: "/saas/support", label: "Support", perm: "SUPPORT_VIEW" },
  { href: "/saas/affiliates", label: "Affiliates", perm: "AFFILIATE_VIEW" },
  { href: "/saas/partners", label: "Partners", perm: "PARTNER_VIEW" },
  { href: "/saas/franchise", label: "Franchise", perm: "FRANCHISE_VIEW" },
  { href: "/saas/audit", label: "Audit", perm: "AUDIT_VIEW" },
  { href: "/marketing-admin", label: "Marketing" },
];

const ICON_KEYS = [
  "dashboard",
  "leads",
  "pipeline",
  "pricing",
  "audit",
  "settings",
  "analytics",
  "campaigns",
  "forms",
] as const;

const QUICK_ACTIONS: QuickAction[] = [
  { label: "+ Organization", href: "/saas/organizations?new=1" },
  { label: "+ Subscription", href: "/saas/subscriptions?new=1" },
];

export const metadata = {
  title: "SaaS Command Center · HospiOS",
  robots: { index: false, follow: false },
};

export default async function SaasLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/saas");
  await initSaasDb().catch(() => {});
  if (!canAccess(user)) {
    return restrictedPanel(
      "SaaS Command Center",
      "This control plane is restricted to platform owners. Ask an administrator to grant you a platform role.",
    );
  }
  const role = roleFor(user);
  const nav = SAAS_NAV.filter((n) => !n.perm || hasSaasPerm(user, n.perm)).map((n, i) => ({
    href: n.href,
    label: n.label,
    icon: <NavIcon name={ICON_KEYS[i % ICON_KEYS.length]} />,
  }));

  return (
    <AppShell
      plane={{ id: "saas", name: "HospiOS Control" }}
      user={{
        name: user.name,
        email: user.email,
        roleLabel: role ? ROLE_LABELS[role] : "",
      }}
      nav={nav}
      quickActions={QUICK_ACTIONS}
      entitySearch
    >
      {children}
    </AppShell>
  );
}
