/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../lib/prisma";

async function main() {
  const plans = await prisma.plan.findMany({ orderBy: { displayOrder: "asc" } });
  for (const p of plans) {
    console.log(p.slug + ": monthly=" + p.monthlyPrice + " annual=" + p.annualPrice + " status=" + p.status);
  }
  const pending = await prisma.planChangeRequest.count({ where: { status: "pending" } });
  console.log("pending requests: " + pending);
  const org = await prisma.organization.count({ where: { businessName: "PricingTest" } });
  console.log("test orgs left: " + org);
  const starter = await prisma.plan.findFirst({ where: { slug: "starter" } });
  if (starter) {
    const rows = await prisma.planCountryPrice.findMany({
      where: { planId: starter.id },
      orderBy: { country: "asc" },
    });
    for (const r of rows.slice(0, 20)) {
      console.log("starter " + r.country + ": " + r.monthly + "/" + r.annual + " " + r.currency);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
