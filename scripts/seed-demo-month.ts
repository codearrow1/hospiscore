/**
 * One-month launch demo seeder (RBAC merge spec §13).
 *
 * Generates ~30 days of realistic activity relative to the run date across
 * both planes. Idempotent: skips when the marker org exists unless --force.
 *
 * Run: npm run seed:demo-month   (reseed: npm run seed:demo-month -- --force)
 */
import { seedDemoMonth } from "@/lib/saas/demoMonth";

const FORCE = process.argv.includes("--force");

seedDemoMonth(FORCE)
  .then((r) => {
    if (r.skipped) {
      console.log("Demo month already seeded — skipping (use --force to reseed).");
    } else {
      console.log("Demo month seeded:");
      console.log(`  campaigns=${r.campaigns} leads=${r.leads} events=${r.events}`);
    }
    console.log(`  orgs=${r.orgs} subs=${r.subs} invoices=${r.invoices} tickets=${r.tickets} commissions=${r.commissions} clicks=${r.clicks}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
