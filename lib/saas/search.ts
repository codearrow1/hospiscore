/**
 * Global SaaS Search — Phase 20
 * Searches Organization, Property, Subscription, Invoice, Payment, Lead (MarketingLead), User
 * Returns grouped results with type and link.
 */

import { prisma } from "@/lib/prisma";
import { listLeads } from "@/lib/marketing/leads";

export type SearchResult = {
  type: "organization" | "property" | "subscription" | "invoice" | "payment" | "lead" | "user";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function globalSearch(q: string, limit = 20): Promise<SearchResult[]> {
  const query = q.trim();
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();

  const [orgs, props, subs, invoices, payments, leads] = await Promise.all([
    prisma.organization.findMany({
      where: { OR: [{ legalName: { contains: query } }, { businessName: { contains: query } }] },
      take: 5,
    }),
    prisma.property.findMany({ where: { name: { contains: query } }, take: 5, include: { organization: { select: { legalName: true } } } }),
    prisma.subscription.findMany({ where: { OR: [{ id: { contains: query } }, { status: { contains: query } }] }, take: 5, include: { organization: { select: { legalName: true } }, plan: { select: { name: true } } } }),
    prisma.invoice.findMany({ where: { OR: [{ id: { contains: query } }, { type: { contains: query } }] }, take: 5, include: { organization: { select: { legalName: true } } } }),
    prisma.payment.findMany({ where: { id: { contains: query } }, take: 5, include: { organization: { select: { legalName: true } } } }),
    listLeads().then((all) => all.filter((l) => [l.name, l.email, l.company, l.propertyName].some((s) => s?.toLowerCase().includes(lower))).slice(0, 5)),
  ]);

  const results: SearchResult[] = [];
  for (const o of orgs) results.push({ type: "organization", id: o.id, title: o.legalName, subtitle: o.businessName || o.country || "", href: `/saas/organizations/${o.id}` });
  for (const p of props) results.push({ type: "property", id: p.id, title: p.name, subtitle: `${p.city || ""} ${p.country || ""} · ${p.organization.legalName}`, href: `/saas/organizations/${p.organizationId}?tab=properties` });
  for (const s of subs) results.push({ type: "subscription", id: s.id, title: `${s.plan.name} · ${s.status}`, subtitle: s.organization.legalName, href: `/saas/subscriptions` });
  for (const i of invoices) results.push({ type: "invoice", id: i.id, title: `Invoice ${i.type} ${(i.amount/100).toFixed(2)}`, subtitle: i.organization.legalName, href: `/saas/billing` });
  for (const pay of payments) results.push({ type: "payment", id: pay.id, title: `Payment ${pay.gateway} ${(pay.amount/100).toFixed(2)}`, subtitle: pay.organization.legalName, href: `/saas/billing` });
  for (const l of leads) results.push({ type: "lead", id: l.id, title: l.name, subtitle: `${l.email} · ${l.stage}`, href: `/marketing-admin/leads/${l.id}` });

  return results.slice(0, limit);
}
