/**
 * Platform-level system settings (Super Admin only). Stored in the Prisma
 * SystemSetting table so they survive deploys and are enforced server-side.
 *
 * Now delegates to the unified Settings Resolution Engine (lib/settings/resolver.ts)
 * which provides dual-read: SystemSetting (DB) → ENV fallback → code default.
 */
import { resolveSetting, updateSetting } from "@/lib/settings/resolver";

/** Canonical setting key — used by the resolver, API, and audit trail. */
export const SETTING_REQUIRE_MARKETING_PRICING_APPROVAL = "pricing_approval_required";

/** Safety default: pricing changes proposed by Marketing Admin need approval. */
export function defaultApprovalRequirement(): boolean {
  return true;
}

/** Pure coercion used by both the service and tests. Defaults to true. */
export function coerceApprovalRequirement(value: unknown): boolean {
  return value === false ? false : value === true ? true : defaultApprovalRequirement();
}

export async function getApprovalRequirement(): Promise<boolean> {
  try {
    const val = await resolveSetting("pricing_approval_required");
    return coerceApprovalRequirement(val);
  } catch {
    return defaultApprovalRequirement();
  }
}

export async function setApprovalRequirement(enabled: boolean, updatedByEmail: string): Promise<boolean> {
  await updateSetting("pricing_approval_required", enabled, updatedByEmail);
  return enabled;
}
