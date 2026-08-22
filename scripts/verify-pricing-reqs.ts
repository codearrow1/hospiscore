/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../lib/prisma";
import { applyCountryPrices } from "../lib/saas/pricingSync";
import { submitMarketingPlanChange, approvePlanChange, rejectPlanChange } from "../lib/saas/planSync";
import { setApprovalRequirement, getApprovalRequirement } from "../lib/saas/settings";
import { createSubscription } from "../lib/saas/subscriptions";
import { getPricingDoc } from "../lib/pricing/db";

const results: { test: string; ok: boolean; detail: string }[] = [];
function check(label: string, condition: boolean, detail: string) {
  results.push({ test: label, ok: condition, detail });
  console.log("  " + (condition ? "PASS" : "FAIL") + " " + label + ": " + detail);
}

const mktgUser = { email: "marketing@hospios.demo", role: "marketing_admin" as const };
const superUser = { email: "superadmin@hospios.demo", role: "super_admin" as const };

async function main() {
  const doc = await getPricingDoc();
  const origUS = JSON.parse(JSON.stringify((doc.profiles.US?.prices as any || {}).starter));
  const origIN = JSON.parse(JSON.stringify((doc.profiles.IN?.prices as any || {}).starter));
  const starter = await prisma.plan.findFirst({ where: { slug: "starter" } });
  if (!starter) throw new Error("starter plan missing");
  const origBilling = { monthly: starter.monthlyPrice, annual: starter.annualPrice };
  const origApproval = await getApprovalRequirement();
  const org = await prisma.organization.create({
    data: { legalName: "Pricing Test Org", businessName: "PricingTest", country: "IN", status: "active" },
  });
  const subIds: string[] = [];
  try {
    // A: SaaS Admin US price -> Marketing
    console.log("\n=== TEST A ===");
    await applyCountryPrices(starter.id, [{ country: "US", currency: "USD", monthly: 95, annual: 950 }], "test-a");
    const docA = await getPricingDoc();
    const usA = (docA.profiles.US?.prices as any || {}).starter;
    check("A", usA?.monthly === 95 && usA?.annual === 950, "US=" + usA?.monthly + "/" + usA?.annual);
    const bA = await prisma.plan.findUnique({ where: { id: starter.id } });
    check("A-billing", bA?.monthlyPrice === 9500 && bA?.annualPrice === 95000, "billing=" + bA?.monthlyPrice + "/" + bA?.annualPrice);

    // B: SaaS Admin IN price -> IN only
    console.log("\n=== TEST B ===");
    await applyCountryPrices(starter.id, [{ country: "IN", currency: "INR", monthly: 2999, annual: 29990 }], "test-b");
    const docB = await getPricingDoc();
    const usB = (docB.profiles.US?.prices as any || {}).starter;
    const inB = (docB.profiles.IN?.prices as any || {}).starter;
    check("B-IN", inB?.monthly === 2999 && inB?.annual === 29990, "IN=" + inB?.monthly + "/" + inB?.annual);
    check("B-US-ok", usB?.monthly === 95 && usB?.annual === 950, "US=" + usB?.monthly + "/" + usB?.annual);

    // C: Marketing submits IN price while approval ON -> pending, SaaS unchanged
    console.log("\n=== TEST C ===");
    await setApprovalRequirement(true, "test-setup");
    const subC = await submitMarketingPlanChange({
      user: mktgUser, action: "update", planId: starter.id,
      patch: { countryPrices: [{ country: "IN", currency: "INR", monthly: 3499, annual: 34990 }] },
      reason: "Test C",
    });
    check("C-pending", subC.outcome === "pending", "outcome=" + subC.outcome);
    const inRowC = await prisma.planCountryPrice.findUnique({ where: { planId_country: { planId: starter.id, country: "IN" } } });
    check("C-SaaS-unchanged", inRowC?.monthly === 2999, "IN=" + inRowC?.monthly + " (not 3499)");

    // D: Approve -> SaaS + Marketing update
    console.log("\n=== TEST D ===");
    if (subC.outcome !== "pending") throw new Error("C did not create request");
    const appr = await approvePlanChange(subC.requestId, superUser, "test-d");
    check("D-approved", appr.ok, "ok=" + appr.ok);
    const inRowD = await prisma.planCountryPrice.findUnique({ where: { planId_country: { planId: starter.id, country: "IN" } } });
    check("D-SaaS", inRowD?.monthly === 3499, "IN=" + inRowD?.monthly + " (expected 3499)");
    const docD = await getPricingDoc();
    const inD = (docD.profiles.IN?.prices as any || {}).starter;
    check("D-Marketing", inD?.monthly === 3499, "IN doc=" + inD?.monthly + " (expected 3499)");

    // E: Reject -> unchanged
    console.log("\n=== TEST E ===");
    const subE = await submitMarketingPlanChange({
      user: mktgUser, action: "update", planId: starter.id,
      patch: { countryPrices: [{ country: "IN", currency: "INR", monthly: 999, annual: 9990 }] },
      reason: "Test E",
    });
    check("E-pending", subE.outcome === "pending", "outcome=" + subE.outcome);
    if (subE.outcome === "pending") {
      const rej = await rejectPlanChange(subE.requestId, superUser, "Rejected: test", "test-e");
      check("E-rejected", rej.ok, "ok=" + rej.ok);
      const inRowE = await prisma.planCountryPrice.findUnique({ where: { planId_country: { planId: starter.id, country: "IN" } } });
      check("E-unchanged", inRowE?.monthly === 3499, "IN=" + inRowE?.monthly + " (not 999)");
    }

    // F: Create India subscription -> INR currency + correct amount
    console.log("\n=== TEST F ===");
    const subF = await createSubscription({
      organizationId: org.id, planId: starter.id, country: "IN",
      billingCycle: "monthly", status: "active",
    });
    subIds.push(subF.id);
    check("F-INR", subF.currency === "INR", "currency=" + subF.currency);
    check("F-IN", subF.country === "IN", "country=" + subF.country);
    check("F-amount", subF.unitAmount === 3499, "unitAmount=" + subF.unitAmount + " (expected 3499)");
    check("F-mrr", subF.mrr > 0, "mrr=" + subF.mrr + " (USD-cents metric preserved)");

    // G: Create US subscription -> USD + correct amount
    console.log("\n=== TEST G ===");
    const subG = await createSubscription({
      organizationId: org.id, planId: starter.id, country: "US",
      billingCycle: "monthly", status: "active",
    });
    subIds.push(subG.id);
    check("G-USD", subG.currency === "USD", "currency=" + subG.currency);
    check("G-US", subG.country === "US", "country=" + subG.country);
    check("G-amount", subG.unitAmount === 95, "unitAmount=" + subG.unitAmount + " (expected 95)");

    // H: Multiple countries -> each retains own currency + amount
    console.log("\n=== TEST H ===");
    const subHGB = await createSubscription({
      organizationId: org.id, planId: starter.id, country: "GB",
      billingCycle: "monthly", status: "active",
    });
    subIds.push(subHGB.id);
    check("H-GBP", subHGB.currency === "GBP", "currency=" + subHGB.currency);
    check("H-GB", subHGB.country === "GB", "country=" + subHGB.country);
    check("H-amount-gb", (subHGB.unitAmount ?? 0) > 0, "unitAmount=" + subHGB.unitAmount);
    check("H-not-usd", subHGB.currency !== "USD", "not converted to USD");

    // I: Existing subscriptions unchanged after pricing modifications
    console.log("\n=== TEST I ===");
    const preF = await prisma.subscription.findUnique({ where: { id: subF.id } });
    const preG = await prisma.subscription.findUnique({ where: { id: subG.id } });
    // Change a different plan's price
    const ent = await prisma.plan.findFirst({ where: { slug: "enterprise" } });
    if (ent) {
      await applyCountryPrices(ent.id, [{ country: "US", currency: "USD", monthly: 0, annual: 0 }], "test-i");
    }
    const postF = await prisma.subscription.findUnique({ where: { id: subF.id } });
    const postG = await prisma.subscription.findUnique({ where: { id: subG.id } });
    check("I-subF-unchanged", preF?.currency === postF?.currency && preF?.unitAmount === postF?.unitAmount,
      "subF: " + preF?.currency + "/" + preF?.unitAmount + " = " + postF?.currency + "/" + postF?.unitAmount);
    check("I-subG-unchanged", preG?.currency === postG?.currency && preG?.unitAmount === postG?.unitAmount,
      "subG: " + preG?.currency + "/" + preG?.unitAmount + " = " + postG?.currency + "/" + postG?.unitAmount);

    // J: Enterprise custom/contact-sales semantics
    console.log("\n=== TEST J ===");
    const entSub = await createSubscription({
      organizationId: org.id, planId: ent!.id, country: "US",
      billingCycle: "monthly", status: "active", unitAmount: 500,
    });
    subIds.push(entSub.id);
    check("J-custom-amount", entSub.unitAmount === 500, "negotiated override=" + entSub.unitAmount);
    check("J-USD", entSub.currency === "USD", "currency=" + entSub.currency);
    // Enterprise without override -> custom = null
    const entSub2 = await createSubscription({
      organizationId: org.id, planId: ent!.id, country: "US",
      billingCycle: "monthly", status: "active",
    });
    subIds.push(entSub2.id);
    check("J-custom-null", entSub2.unitAmount === null, "no override unitAmount=" + entSub2.unitAmount);

  } finally {
    // Restore baseline
    console.log("\n=== RESTORE ===");
    await applyCountryPrices(starter.id, [
      { country: "US", currency: "USD", monthly: origUS?.monthly ?? 89, annual: origUS?.annual ?? 890 },
      { country: "IN", currency: "INR", monthly: origIN?.monthly ?? 1999, annual: origIN?.annual ?? 19990 },
    ], "test-restore");
    // Restore billing if changed
    const currentStarter = await prisma.plan.findUnique({ where: { id: starter.id } });
    if (currentStarter && (currentStarter.monthlyPrice !== origBilling.monthly || currentStarter.annualPrice !== origBilling.annual)) {
      await prisma.plan.update({
        where: { id: starter.id },
        data: { monthlyPrice: origBilling.monthly, annualPrice: origBilling.annual },
      });
    }
    await setApprovalRequirement(origApproval, "test-restore");
    // Clean up subscriptions + org
    for (const sid of subIds) {
      await prisma.subscription.delete({ where: { id: sid } }).catch(() => {});
    }
    await prisma.organization.delete({ where: { id: org.id } }).catch(() => {});
    // Clean up pending change requests
    await prisma.planChangeRequest.deleteMany({
      where: { requestedByEmail: "marketing@hospios.demo", status: "pending" },
    });
    console.log("Restored.\n");
  }

  // Summary
  console.log("========================================");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log("RESULTS: " + passed + " passed, " + failed + " failed, " + results.length + " total");
  if (failed > 0) {
    console.log("FAILURES:");
    for (const r of results.filter((r) => !r.ok)) console.log("  " + r.test + ": " + r.detail);
  }
  console.log("========================================");
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

