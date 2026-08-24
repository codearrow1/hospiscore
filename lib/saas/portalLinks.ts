/**
 * Portal identity linking (S-01).
 *
 * Portal identities — Affiliate, Partner, OrgContact — were previously
 * resolved by raw email match, so anyone could register an unverified email
 * and inherit the victim's portal data. Identity is now explicit:
 *
 *  - Affiliate / Partner rows carry an optional `userId` column (direct link).
 *  - Column-less kinds (OrgContact) use a KV binding record instead.
 *  - Fresh accounts can only obtain a binding by redeeming a one-time,
 *    short-lived claim token minted by an authorized admin out-of-band.
 *
 * Bindings live in the SystemSetting table (`portal_bindings`, keyed by
 * userId) so no schema migration is needed for contact-kind links.
 */
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type PortalKind = "affiliate" | "partner" | "org_contact";
export const PORTAL_KINDS: readonly PortalKind[] = ["affiliate", "partner", "org_contact"];

export function isPortalKind(v: unknown): v is PortalKind {
  return typeof v === "string" && (PORTAL_KINDS as readonly string[]).includes(v);
}

export interface PortalBinding {
  kind: PortalKind;
  refId: string;
  boundAt: string;
  boundBy: string;
}

export interface PortalClaimRecord {
  kind: PortalKind;
  refId: string;
  expiresAt: string;
  createdBy: string;
}

const BINDINGS_KEY = "portal_bindings";
const CLAIMS_KEY = "portal_claims";
export const CLAIM_TTL_MS = 15 * 60_000;

/** Injectable KV seam so the pure logic is unit-testable without Prisma. */
export interface PortalStore {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}

let storeOverride: PortalStore | null = null;

/** Test seam: pass a fake store, or null to restore the default Prisma-backed one. */
export function __setPortalStore(s: PortalStore | null): void {
  storeOverride = s;
}

async function readMap(key: string): Promise<Record<string, PortalBinding | PortalClaimRecord>> {
  let raw: unknown;
  if (storeOverride) {
    raw = await storeOverride.read(key);
  } else {
    try {
      const row = await prisma.systemSetting.findUnique({ where: { key } });
      raw = row?.value ?? {};
    } catch {
      raw = {};
    }
  }
  return (raw ?? {}) as Record<string, PortalBinding | PortalClaimRecord>;
}

async function writeMap(key: string, map: Record<string, PortalBinding | PortalClaimRecord>): Promise<void> {
  if (storeOverride) {
    await storeOverride.write(key, map);
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: map as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
    create: { key, value: map as unknown as Prisma.InputJsonValue, updatedByEmail: "system" },
  });
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** Pure expiry check (tests). */
export function isClaimExpired(rec: Pick<PortalClaimRecord, "expiresAt">, now = Date.now()): boolean {
  const t = Date.parse(rec.expiresAt);
  return !Number.isFinite(t) || t <= now;
}

function assertTargetExists(kind: PortalKind, refId: string): Promise<boolean> {
  // Skipped under an injected store (unit tests); always enforced in production paths.
  if (storeOverride) return Promise.resolve(true);
  switch (kind) {
    case "affiliate":
      return prisma.affiliate.findUnique({ where: { id: refId }, select: { id: true } }).then((r) => !!r);
    case "partner":
      return prisma.partner.findUnique({ where: { id: refId }, select: { id: true } }).then((r) => !!r);
    case "org_contact":
      return prisma.orgContact.findUnique({ where: { id: refId }, select: { id: true } }).then((r) => !!r);
  }
}

/** Bind a user to a portal identity directly (admin path). Overwrites any prior binding. */
export async function bindPortalIdentity(params: { kind: PortalKind; refId: string; userId: string; boundBy: string }): Promise<PortalBinding> {
  if (!(await assertTargetExists(params.kind, params.refId))) {
    throw new Error("Portal identity not found");
  }
  const binding: PortalBinding = {
    kind: params.kind,
    refId: params.refId,
    boundAt: new Date().toISOString(),
    boundBy: params.boundBy,
  };
  const map = await readMap(BINDINGS_KEY);
  map[params.userId] = binding;
  await writeMap(BINDINGS_KEY, map);
  // Mirror onto the relational columns where they exist so both stores agree.
  // (Skipped under an injected store — unit tests have no database.)
  if (!storeOverride) {
    if (params.kind === "affiliate") {
      await prisma.affiliate.update({ where: { id: params.refId }, data: { userId: params.userId } });
    } else if (params.kind === "partner") {
      await prisma.partner.update({ where: { id: params.refId }, data: { userId: params.userId } });
    }
  }
  return binding;
}

export async function getPortalBinding(userId: string): Promise<PortalBinding | null> {
  const map = await readMap(BINDINGS_KEY);
  return (map[userId] as PortalBinding | undefined) ?? null;
}

export async function unbindPortalIdentity(userId: string): Promise<boolean> {
  const map = await readMap(BINDINGS_KEY);
  if (!map[userId]) return false;
  delete map[userId];
  await writeMap(BINDINGS_KEY, map);
  return true;
}

/**
 * Mint a one-time claim token for an existing portal identity. The token is
 * returned in plaintext exactly once; only its SHA-256 hash is stored.
 */
export async function createPortalClaimToken(params: { kind: PortalKind; refId: string; createdBy: string }): Promise<{ token: string; expiresAt: string }> {
  if (!(await assertTargetExists(params.kind, params.refId))) {
    throw new Error("Portal identity not found");
  }
  const token = randomBytes(24).toString("base64url");
  const rec: PortalClaimRecord = {
    kind: params.kind,
    refId: params.refId,
    expiresAt: new Date(Date.now() + CLAIM_TTL_MS).toISOString(),
    createdBy: params.createdBy,
  };
  const map = await readMap(CLAIMS_KEY);
  // Opportunistic sweep of stale claims so the map cannot grow forever.
  for (const [h, r] of Object.entries(map)) {
    if (isClaimExpired(r as PortalClaimRecord)) delete map[h];
  }
  map[hashToken(token)] = rec;
  await writeMap(CLAIMS_KEY, map);
  return { token, expiresAt: rec.expiresAt };
}

/** Non-destructive claim check for pre-validating registration input. */
export async function peekPortalClaimToken(token: string): Promise<PortalClaimRecord | null> {
  const claims = await readMap(CLAIMS_KEY);
  const rec = claims[hashToken(token)] as PortalClaimRecord | undefined;
  if (!rec || isClaimExpired(rec)) return null;
  return rec;
}

/**
 * Redeem a claim token: binds `userId` to the recorded identity and burns the
 * token. Throws with a safe message on invalid/expired tokens.
 */
export async function consumePortalClaimToken(params: { token: string; userId: string; boundBy: string }): Promise<PortalBinding> {
  const h = hashToken(params.token);
  const claims = await readMap(CLAIMS_KEY);
  const rec = claims[h] as PortalClaimRecord | undefined;
  if (!rec) throw new Error("Invalid or expired claim token");
  if (isClaimExpired(rec)) {
    delete claims[h];
    await writeMap(CLAIMS_KEY, claims);
    throw new Error("Invalid or expired claim token");
  }
  delete claims[h];
  await writeMap(CLAIMS_KEY, claims);
  return bindPortalIdentity({ kind: rec.kind, refId: rec.refId, userId: params.userId, boundBy: params.boundBy });
}

// ---------------------------------------------------------------------------
// Resolution helpers — the ONLY sanctioned ways portals identify their caller.
// ---------------------------------------------------------------------------

/** Affiliate for a signed-in user: explicit userId column or KV binding. */
export async function findAffiliateForUser(userId: string) {
  const byColumn = await prisma.affiliate.findFirst({ where: { userId } });
  if (byColumn) return byColumn;
  const b = await getPortalBinding(userId);
  if (!b || b.kind !== "affiliate") return null;
  return prisma.affiliate.findUnique({ where: { id: b.refId } });
}

/** Partner for a signed-in user: explicit userId column or KV binding. */
export async function findPartnerForUser(userId: string) {
  const byColumn = await prisma.partner.findFirst({ where: { userId } });
  if (byColumn) return byColumn;
  const b = await getPortalBinding(userId);
  if (!b || b.kind !== "partner") return null;
  return prisma.partner.findUnique({ where: { id: b.refId } });
}

/** Primary org contact for a signed-in user: KV binding only (no column). */
export async function findOrgContactForUser(userId: string) {
  const b = await getPortalBinding(userId);
  if (!b || b.kind !== "org_contact") return null;
  return prisma.orgContact.findFirst({
    where: { id: b.refId, organization: { status: { not: "cancelled" } } },
    orderBy: { isPrimary: "desc" },
    include: { organization: true },
  });
}

export { BINDINGS_KEY, CLAIMS_KEY };
