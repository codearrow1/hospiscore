/**
 * Platform-level system settings (Super Admin only). Stored in the Prisma
 * SystemSetting table so they survive deploys and are enforced server-side.
 */
import { prisma } from "@/lib/prisma";

export const SETTING_REQUIRE_MARKETING_PRICING_APPROVAL =
  "require_marketing_pricing_approval";

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
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_REQUIRE_MARKETING_PRICING_APPROVAL },
    });
    if (!row) return defaultApprovalRequirement();
    return coerceApprovalRequirement((row.value as { enabled?: unknown } | null)?.enabled);
  } catch {
    // Table missing on very old databases — behave safely (approval ON).
    return defaultApprovalRequirement();
  }
}

export async function setApprovalRequirement(enabled: boolean, updatedByEmail: string): Promise<boolean> {
  await prisma.systemSetting.upsert({
    where: { key: SETTING_REQUIRE_MARKETING_PRICING_APPROVAL },
    update: { value: { enabled }, updatedByEmail, updatedAt: new Date() },
    create: {
      key: SETTING_REQUIRE_MARKETING_PRICING_APPROVAL,
      value: { enabled },
      updatedByEmail,
    },
  });
  return enabled;
}
