/**
 * Growth-pipeline persistence flag (checkpoint 1).
 *
 * Gates whether the marketing growth pipeline (leads / demos / report
 * requests / conversions) is ALSO persisted into the Prisma SaaS plane, in
 * addition to the legacy JSON DataFile. Reading this flag must never crash the
 * marketing site, so the Prisma client is imported lazily and any DB/migration
 * error is treated as "feature off".
 *
 * See docs/adr/0001-growth-pipeline-in-prisma.md
 */

export const GROWTH_PERSIST_FLAG = "growth.persist.prisma";

/**
 * True when a global (unscoped) FeatureFlag enables `growth.persist.prisma`.
 * Any failure (missing DB, un-migrated schema) resolves to false.
 */
export async function isGrowthPersistEnabled(): Promise<boolean> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const flags = await prisma.featureFlag.findMany({
      where: { key: GROWTH_PERSIST_FLAG },
      orderBy: { createdAt: "desc" },
      select: { enabled: true, organizationId: true, planId: true, propertyId: true, country: true },
    });
    // Pick the most specific flag that applies globally (no scope), matching the
    // entitlements resolution order so the same row governs the whole pipeline.
    const global = flags.find(
      (f) => !f.organizationId && !f.planId && !f.propertyId && !f.country,
    );
    return global?.enabled ?? false;
  } catch {
    return false;
  }
}
