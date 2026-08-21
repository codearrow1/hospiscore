import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Customer portal — resolves the caller's organization via their primary
// OrgContact email and returns only that org's subscription/billing/usage.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const contact = await prisma.orgContact.findFirst({
    where: { email: user.email, organization: { status: { not: "cancelled" } } },
    orderBy: { isPrimary: "desc" },
    include: { organization: true },
  });
  if (!contact) {
    return NextResponse.json({ customer: null, subscriptions: [], invoices: [], usage30d: 0 });
  }
  const orgId = contact.organization.id;
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [subscriptions, invoices, usage] = await Promise.all([
    prisma.subscription.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true, slug: true } } },
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.usageRecord.aggregate({
      where: { organizationId: orgId, recordedAt: { gte: since } },
      _sum: { quantity: true },
    }),
  ]);

  return NextResponse.json({
    customer: { organization: contact.organization, contact: { name: contact.name, email: contact.email, role: contact.role } },
    subscriptions,
    invoices,
    usage30d: usage._sum.quantity ?? 0,
  });
}
