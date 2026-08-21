/**
 * Marketing store seeding + historical migration.
 *
 * - `ensureMarketingStore` is called by read paths: seeds default form configs
 *   when absent, and migrates historical `demoRequests`/`reportRequests` into
 *   the unified lead CRM exactly once (preserving source attribution).
 * - `ensureDemoUsers` creates the DEVELOPMENT-ONLY demo accounts (Phase 35).
 *   It refuses to run in production; passwords are stored scrypt-hashed via
 *   the existing auth system.
 */

import { readData, writeData } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_FORMS } from "./forms";
import { upsertLead } from "./leads";

let storeReady = false;

function demoSeedingAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_SEED === "1";
}

/** Just like the CLI path, but never throws — used by lazy store seeding. */
export async function ensureDemoUsersIfAllowed(
  target?: string,
): Promise<{ created: string[]; existing: string[] }> {
  if (!demoSeedingAllowed()) return { created: [], existing: [] };
  return ensureDemoUsers(target);
}

/** Idempotent: forms + historical lead migration (+ demo users when allowed). */
export async function ensureMarketingStore(target?: string): Promise<void> {
  if (!target && storeReady) return;
  const data = await readData(target);

  if (!data.forms?.length) {
    await writeData((d) => ({ ...d, forms: DEFAULT_FORMS.map((f) => ({ ...f })) }), target);
  }

  const migrated = (data.leads ?? []).length === 0 && (data.demoRequests.length > 0 || data.reportRequests.length > 0);
  if (migrated) {
    for (const r of data.demoRequests) {
      await upsertLead(
        {
          name: r.name,
          email: r.email,
          company: r.company,
          propertyName: r.propertyName,
          rooms: r.propertyCount,
          message: r.message,
          planInterest: r.plan,
          billingCycle: r.billingCycle,
          country: r.country,
          source: "demo_page",
          attribution: { pagePath: "/demo", country: r.country },
        },
        target,
      );
    }
    for (const r of data.reportRequests) {
      await upsertLead(
        {
          name: r.name,
          email: r.email,
          phone: r.phone,
          propertyName: r.propertyName,
          source: "organic",
          attribution: { pagePath: `/properties/${r.propertySlug ?? ""}` },
        },
        target,
      );
    }
  }

  // Demo team accounts — only on the real store, only when allowed. Idempotent.
  if (!target) await ensureDemoUsersIfAllowed();

  storeReady = !target;
}

export const DEMO_USERS: {
  email: string;
  password: string;
  name: string;
  role: string;
}[] = [
  { email: "superadmin@hospios.demo", password: "Hospios@Demo2026!", name: "Super Admin", role: "super_admin" },
  { email: "marketing@hospios.demo", password: "Marketing@Demo2026!", name: "Subadmin (Marketing)", role: "marketing_admin" },
  { email: "salesmanager@hospios.demo", password: "Sales@Demo2026!", name: "Sales Manager", role: "sales_manager" },
  { email: "sales@hospios.demo", password: "SalesRep@Demo2026!", name: "Sales Rep", role: "sales_rep" },
  { email: "content@hospios.demo", password: "Content@Demo2026!", name: "Content Editor", role: "content_editor" },
  { email: "analyst@hospios.demo", password: "Analytics@Demo2026!", name: "Analyst", role: "analyst" },
  // Portal-only roles (RBAC merge): no marketing admin access; identity is
  // resolved from the SaaS plane (Affiliate/Partner/OrgContact rows).
  { email: "affiliate@hospios.demo", password: "Affiliate@Demo2026!", name: "Demo Affiliate", role: "" },
  { email: "partner@hospios.demo", password: "Partner@Demo2026!", name: "Demo Partner", role: "" },
  { email: "customer@hospios.demo", password: "Customer@Demo2026!", name: "Demo Customer", role: "" },
  { email: "customer2@hospios.demo", password: "Customer2@Demo2026!", name: "Second Demo Customer", role: "" },
  { email: "staff@hospios.demo", password: "Staff@Demo2026!", name: "Support Staff", role: "support_admin" },
];

/**
 * Create the dev-only demo accounts if missing. Hard refuses in production
 * unless `ALLOW_DEMO_SEED=1` is explicitly set (still discouraged).
 */
export async function ensureDemoUsers(target?: string): Promise<{ created: string[]; existing: string[] }> {
  if (!demoSeedingAllowed()) {
    throw new Error("Refusing to seed demo users in production (set ALLOW_DEMO_SEED=1 to enable)");
  }
  const created: string[] = [];
  const existing: string[] = [];
  for (const d of DEMO_USERS) {
    const data = await readData(target);
    const found = data.users.some((u) => u.email === d.email);
    if (found) {
      existing.push(d.email);
      continue;
    }
    await upsertDemoUser(d, target);
    created.push(d.email);
  }
  if (!target) await ensurePortalIdentities();
  return { created, existing };
}

async function upsertDemoUser(
  d: { email: string; password: string; name: string; role: string },
  target?: string,
): Promise<void> {
  const passwordHash = await hashPassword(d.password);
  const id = newId();
  await writeData(
    (prev) => {
      if (prev.users.some((u) => u.email === d.email)) return prev;
      return {
        ...prev,
        users: [
          ...prev.users,
          {
            id,
            name: d.name,
            email: d.email,
            createdAt: new Date().toISOString(),
            passwordHash,
            role: d.role,
          },
        ],
      };
    },
    target,
  );
}

function newId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Dev-only script entry (`npm run seed:marketing-demo`). */
export async function seedDemoUsersCli(): Promise<void> {
  const { created, existing } = await ensureDemoUsers();
  await ensurePortalIdentities();
  const note =
    process.env.NODE_ENV === "production"
      ? "WARNING: NODE_ENV=production — demo seeding explicitly allowed via ALLOW_DEMO_SEED=1"
      : "Development seeding";
  console.log(`${note}`);
  console.log(`Created: ${created.length ? created.join(", ") : "none"}`);
  console.log(`Already present: ${existing.length ? existing.join(", ") : "none"}`);
}

/**
 * Portal identities for the portal-only demo roles (RBAC merge). Idempotent,
 * keyed by the demo emails. Gives affiliate/partner/customer/staff users real
 * rows so their portals resolve data.
 */
export async function ensurePortalIdentities(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  await prisma.affiliate.upsert({
    where: { email: "affiliate@hospios.demo" },
    update: {},
    create: {
      name: "Demo Affiliate",
      email: "affiliate@hospios.demo",
      country: "US",
      audience: "Hospitality bloggers & hotel-tech newsletters",
      promotionMethod: "content",
      status: "active",
      referralCode: "AFFDEMO01",
      tier: "standard",
      commissionModel: "percent_mrr_12",
      commissionValue: 2000,
    },
  });

  await prisma.partner.upsert({
    where: { email: "partner@hospios.demo" },
    update: {},
    create: {
      name: "Demo Partner",
      company: "Demo Partner Agency",
      email: "partner@hospios.demo",
      country: "US",
      type: "reseller",
      tier: "silver",
      status: "active",
      commissionModel: "percent_first",
      commissionValue: 1500,
      referralCode: "PTNDEMO01",
    },
  });

  let plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
  if (!plan) {
    const { seedDefaultPlans } = await import("@/lib/saas/plans");
    await seedDefaultPlans();
    plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } });
  }
  if (!plan) return;

  const { syncOrgMrr } = await import("@/lib/saas/subscriptions");
  const customerSpecs = [
    { email: "customer@hospios.demo", name: "Demo Customer", org: "Demo Grand Hotel" },
    { email: "customer2@hospios.demo", name: "Second Demo Customer", org: "Demo Grand Resort" },
  ];
  for (const spec of customerSpecs) {
    const existingOrg = await prisma.organization.findFirst({
      where: { contacts: { some: { email: spec.email } } },
    });
    if (existingOrg) {
      await syncOrgMrr(existingOrg.id);
      continue;
    }
    const org = await prisma.organization.create({
      data: {
        legalName: spec.org,
        businessName: spec.org,
        country: "US",
        industry: "hospitality",
        status: "active",
        acquisitionSource: "organic",
        contacts: {
          create: {
            name: spec.name,
            email: spec.email,
            role: "owner",
            isPrimary: true,
          },
        },
      },
    });
    const now = new Date();
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: "active",
        billingCycle: "monthly",
        mrr: plan.monthlyPrice,
        quantity: 1,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });
    await syncOrgMrr(org.id);
  }
}