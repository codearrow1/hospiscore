/**
 * SaaS Audit — immutable, append-only. Writes to both DataFile (legacy) and Prisma AuditLog (primary) with
 * requestId, before/after, ip, actor. Never log secrets/tokens/passwords/payment credentials.
 * Phase 22: every sensitive action must be logged (plan/price change, sub cancel, refund, payout, etc.)
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { writeAudit as writeMarketingAudit } from "@/lib/marketing/audit";

export async function writeSaasAudit(input: {
  byEmail: string;
  action: string; // e.g. org.created, org.updated, property.created, subscription.status_changed
  entity: string; // organization|property|subscription|plan|invoice|payment|feature_flag|territory
  entityId?: string;
  detail?: string;
  ip?: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
  actorId?: string;
}) {
  const requestId = input.requestId ?? randomUUID();
  const detail = [
    input.detail,
    input.before ? `before=${JSON.stringify(input.before).slice(0, 800)}` : "",
    input.after ? `after=${JSON.stringify(input.after).slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  // Legacy DataFile audit (capped 5k) for backward compat
  await writeMarketingAudit({
    byEmail: input.byEmail,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    detail: detail.slice(0, 2000) || undefined,
    ip: input.ip,
  });
  // Primary Prisma immutable log
  try {
    await prisma.auditLog.create({
      data: {
        actorEmail: input.byEmail.toLowerCase(),
        actorId: input.actorId || null,
        action: input.action,
        targetType: input.entity,
        targetId: input.entityId || null,
        before: input.before != null ? (input.before as never) : undefined,
        after: input.after != null ? (input.after as never) : undefined,
        ip: input.ip || null,
        requestId,
      },
    });
  } catch (e) {
    // Audit must never break business flow — log and continue
    console.error("Prisma audit write failed", e);
  }
}

export async function listAuditLogs(opts?: { actorEmail?: string; action?: string; targetType?: string; take?: number; skip?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.actorEmail) where.actorEmail = opts.actorEmail;
  if (opts?.action) where.action = { contains: opts.action };
  if (opts?.targetType) where.targetType = opts.targetType;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { timestamp: "desc" }, take: opts?.take ?? 50, skip: opts?.skip ?? 0 }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total };
}
