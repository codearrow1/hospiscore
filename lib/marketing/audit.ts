/**
 * Audit log (Phase 34) — append-only trail of marketing-admin actions and
 * form captures. Stored in the shared document; capped to avoid unbounded
 * growth.
 */

import { randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import type { AuditEntry } from "./types";

const MAX_ENTRIES = 5_000;

export async function writeAudit(
  input: {
    byEmail: string;
    action: string;
    entity: string;
    entityId?: string;
    detail?: string;
    ip?: string;
  },
  target?: string,
): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    byEmail: input.byEmail.toLowerCase(),
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    detail: input.detail,
    ip: input.ip,
  };
  await writeData(
    (d) => ({
      ...d,
      auditLog: [...(d.auditLog ?? []), entry].slice(-MAX_ENTRIES),
    }),
    target,
  );
  return entry;
}

export async function listAudit(
  limit = 200,
  target?: string,
): Promise<AuditEntry[]> {
  const data = await readData(target);
  return [...(data.auditLog ?? [])].reverse().slice(0, limit);
}

export async function countAudit(target?: string): Promise<number> {
  const data = await readData(target);
  return data.auditLog?.length ?? 0;
}