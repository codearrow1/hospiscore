import Link from "next/link";
import type { AppRole } from "@/lib/rbac";

type NavItem = { href: string; label: string };

/**
 * Permission-aware portal navigation. Items are generated from the caller's
 * canonical role only — every link points at a route the role is authorized
 * to use, so the nav never exposes a route the backend would reject.
 */
const ROLE_NAV: Record<AppRole, NavItem[]> = {
  super_admin: [
    { href: "/saas", label: "Dashboard" },
    { href: "/saas/organizations", label: "Tenants" },
    { href: "/saas/subscriptions", label: "Subscriptions" },
    { href: "/saas/billing", label: "Billing" },
    { href: "/saas/affiliates", label: "Affiliates" },
    { href: "/saas/partners", label: "Partners" },
    { href: "/saas/support", label: "Support" },
  ],
  subadmin: [
    { href: "/subadmin", label: "Dashboard" },
    { href: "/marketing-admin/leads", label: "Leads" },
    { href: "/marketing-admin/campaigns", label: "Campaigns" },
    { href: "/marketing-admin/pipeline", label: "Pipeline" },
    { href: "/marketing-admin/analytics", label: "Analytics" },
    { href: "/account", label: "Profile" },
  ],
  staff: [
    { href: "/staff", label: "Queue" },
    { href: "/account", label: "Profile" },
  ],
  affiliate: [
    { href: "/affiliate", label: "Dashboard" },
    { href: "/affiliate#commissions", label: "Commissions" },
    { href: "/affiliate#payouts", label: "Payouts" },
    { href: "/account", label: "Profile" },
  ],
  partner: [
    { href: "/partner", label: "Dashboard" },
    { href: "/partner#referrals", label: "Referrals" },
    { href: "/partner#commissions", label: "Commissions" },
    { href: "/partner#payouts", label: "Payouts" },
    { href: "/account", label: "Profile" },
  ],
  customer: [
    { href: "/customer", label: "Dashboard" },
    { href: "/customer#subscription", label: "Subscription" },
    { href: "/customer#usage", label: "Usage" },
    { href: "/customer#billing", label: "Billing" },
    { href: "/account", label: "Profile" },
  ],
};

export default function PortalNav({ role }: { role: AppRole }) {
  const items = ROLE_NAV[role];
  return (
    <nav aria-label="Portal navigation" className="border-b border-zinc-200 dark:border-zinc-800">
      <ul className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 text-sm">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="inline-block whitespace-nowrap rounded-md px-3 py-2 font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
