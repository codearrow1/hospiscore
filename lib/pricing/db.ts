/**
 * Pricing database (server-only). Persists the active pricing document in
 * the shared data store (`readData`/`writeData`) and enforces price
 * versioning: every edit snapshots the current pricing into `history`, so
 * existing subscriptions keep the version they were created on while new
 * customers get the latest version.
 */
import { readData, writeData } from "@/lib/db";
import { CURRENCIES } from "./currencies";
import { SEED_PROFILES } from "./defaults";
import type { PricingDoc, PricingProfile } from "./types";
import { PLAN_IDS } from "./catalog";

const REGIONS = new Set([
  "na", "europe", "mena", "asia", "africa", "oceania", "global",
]);

export function seedPricingDoc(): PricingDoc {
  return {
    version: 1,
    updatedAt: "",
    profiles: structuredClone(SEED_PROFILES),
    history: [],
  };
}

/** Basic shape validation for a single country profile. */
export function profileErrors(profile: PricingProfile): string[] {
  const errors: string[] = [];
  const code = profile.country?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) errors.push(`Country code must be 2 letters (got "${code}")`);
  if (!CURRENCIES[profile.currency]) errors.push(`Unknown currency "${profile.currency}" for ${code}`);
  if (!REGIONS.has(profile.region)) errors.push(`Unknown region "${profile.region}" for ${code}`);
  if (!profile.tax || !["inclusive", "exclusive", "none"].includes(profile.tax.mode)) {
    errors.push(`Invalid tax mode for ${code}`);
  }
  if (typeof profile.tax?.rate !== "number" || profile.tax.rate < 0 || profile.tax.rate > 100) {
    errors.push(`Tax rate must be 0–100 for ${code}`);
  }
  if (!Array.isArray(profile.gateways) || profile.gateways.length === 0) {
    errors.push(`At least one payment gateway is required for ${code}`);
  }
  for (const id of PLAN_IDS) {
    const p = profile.prices?.[id];
    if (!p) {
      errors.push(`Missing prices for plan "${id}" in ${code}`);
      continue;
    }
    const isEnterprise = id === "enterprise";
    if (!Number.isFinite(p.monthly) || p.monthly < 0) {
      errors.push(`Invalid monthly price for plan "${id}" in ${code}`);
    }
    if (!isEnterprise && (!Number.isFinite(p.annual) || p.annual <= 0)) {
      errors.push(`Invalid annual price for plan "${id}" in ${code}`);
    }
    if (isEnterprise && p.monthly !== 0 && p.annual !== 0) {
      errors.push(`Enterprise prices must be 0 (custom) in ${code}`);
    }
  }
  return errors;
}

/** Validate the whole pricing document. Returns [] when valid. */
export function pricingDocErrors(
  doc: Pick<PricingDoc, "profiles">,
): string[] {
  const errors: string[] = [];
  for (const [code, profile] of Object.entries(doc.profiles)) {
    const errs = profileErrors(profile);
    for (const e of errs) errors.push(e);
    if (profile.country?.trim().toUpperCase() !== code) {
      errors.push(`Profile key "${code}" does not match country field`);
    }
  }
  return errors;
}

/** Read the current pricing document, seeding it on first use. */
export async function getPricingDoc(
  target?: string,
): Promise<PricingDoc> {
  const data = await readData(target);
  if (data.pricing) return data.pricing;
  const seed = seedPricingDoc();
  await writeData((d) => ({ ...d, pricing: seed }), target);
  return seed;
}

/**
 * Persist a new pricing version. `profiles` replaces the active set; the
 * current active set is snapshotted into `history` first. No-op (and no new
 * version) when nothing changed. Throws listing validation errors.
 */
export async function savePricingDoc(
  input: { profiles: Record<string, PricingProfile>; label: string; byEmail: string },
  target?: string,
): Promise<PricingDoc> {
  const current = await getPricingDoc(target);

  const next: PricingDoc = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    profiles: input.profiles,
    history: [
      ...current.history,
      {
        version: current.version,
        createdAt: current.updatedAt || new Date().toISOString(),
        label: current.version === 1 ? "Initial configuration" : input.label,
        byEmail: current.version === 1 ? "" : input.byEmail,
        profiles: cloneProfiles(current.profiles),
      },
    ],
  };

  const errors = pricingDocErrors(next);
  if (errors.length > 0) {
    throw new Error(`Invalid pricing: ${errors[0]}`);
  }

  const unchanged =
    JSON.stringify(next.profiles) === JSON.stringify(current.profiles);

  if (unchanged) return current;

  await writeData((d) => ({ ...d, pricing: next }), target);
  return next;
}

/** Reset to seed defaults (new version, previous state preserved in history). */
export async function resetPricingDoc(
  byEmail: string,
  target?: string,
): Promise<PricingDoc> {
  const seed = seedPricingDoc();
  const current = await getPricingDoc(target);
  const next: PricingDoc = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    profiles: seed.profiles,
    history: [
      ...current.history,
      {
        version: current.version,
        createdAt: current.updatedAt || new Date().toISOString(),
        label: "",
        byEmail,
        profiles: cloneProfiles(current.profiles),
      },
    ],
  };
  await writeData((d) => ({ ...d, pricing: next }), target);
  return next;
}

function cloneProfiles(
  profiles: Record<string, PricingProfile>,
): Record<string, PricingProfile> {
  return structuredClone(profiles);
}