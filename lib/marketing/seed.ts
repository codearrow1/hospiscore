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
  { email: "marketing@hospios.demo", password: "Marketing@Demo2026!", name: "Marketing Admin", role: "marketing_admin" },
  { email: "salesmanager@hospios.demo", password: "Sales@Demo2026!", name: "Sales Manager", role: "sales_manager" },
  { email: "sales@hospios.demo", password: "SalesRep@Demo2026!", name: "Sales Rep", role: "sales_rep" },
  { email: "content@hospios.demo", password: "Content@Demo2026!", name: "Content Editor", role: "content_editor" },
  { email: "analyst@hospios.demo", password: "Analytics@Demo2026!", name: "Analyst", role: "analyst" },
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
  const note =
    process.env.NODE_ENV === "production"
      ? "WARNING: NODE_ENV=production — demo seeding explicitly allowed via ALLOW_DEMO_SEED=1"
      : "Development seeding";
  console.log(`${note}`);
  console.log(`Created: ${created.length ? created.join(", ") : "none"}`);
  console.log(`Already present: ${existing.length ? existing.join(", ") : "none"}`);
}