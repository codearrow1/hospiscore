/**
 * Reset the one-month demo dataset (companion to seed-demo-month.ts).
 * Removes demo-month SaaS rows and demo leads/campaigns/events; keeps demo
 * USERS and portal identities so logins keep working.
 *
 * Run: npx tsx scripts/reset-demo-month.ts
 */
import { prisma } from "@/lib/prisma";
import { writeData } from "@/lib/db";

async function main(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { legalName: { startsWith: "Demo Month Org" } },
    select: { id: true },
  });
  for (const org of orgs) {
    await prisma.organization.delete({ where: { id: org.id } }); // cascades subs/invoices/usage/tickets
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { email: "affiliate@hospios.demo" } });
  if (affiliate) {
    await prisma.affiliatePayout.deleteMany({ where: { affiliateId: affiliate.id } });
    await prisma.affiliateCommission.deleteMany({ where: { affiliateId: affiliate.id } });
    await prisma.affiliateClick.deleteMany({ where: { affiliateId: affiliate.id } });
  }
  const partner = await prisma.partner.findUnique({ where: { email: "partner@hospios.demo" } });
  if (partner) {
    await prisma.affiliatePayout.deleteMany({ where: { partnerId: partner.id } });
    await prisma.affiliateCommission.deleteMany({ where: { partnerId: partner.id } });
  }
  const portalOrg = await prisma.organization.findFirst({
    where: { contacts: { some: { email: "customer@hospios.demo" } } },
  });
  if (portalOrg) {
    await prisma.usageRecord.deleteMany({ where: { organizationId: portalOrg.id } });
  }

  await writeData((d) => ({
    ...d,
    campaigns: (d.campaigns ?? []).filter((c) => !c.id.startsWith("camp-demo-")),
    leads: (d.leads ?? []).filter((l) => !l.id.startsWith("lead-demo-")),
    leadEvents: (d.leadEvents ?? []).filter((e) => !e.id.startsWith("lead-demo-")),
  }));

  console.log(`Reset complete: removed ${orgs.length} demo orgs + related rows, demo leads/campaigns/events.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
