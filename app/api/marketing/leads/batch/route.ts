import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import {
  deleteLead,
  getLead,
  moveStage,
  updateLead,
} from "@/lib/marketing/leads";
import { writeAudit } from "@/lib/marketing/audit";
import { isLeadStage, isLostReason } from "@/lib/marketing/stages";
import type { LostReason } from "@/lib/marketing/stages";
import { canAccessLead, hasCapability } from "@/lib/marketing/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 100;

interface BatchResult {
  id: string;
  ok: boolean;
  error?: string;
}

/**
 * POST /api/marketing/leads/batch — one round-trip bulk action.
 *
 * Body: { action: "stage" | "owner" | "delete", ids: string[],
 *         stage?, lostReason?, ownerEmail? }
 *
 * Replaces the old sequential per-lead fetch loop in the UI: authorization
 * (capability + per-lead access), validation and auditing all happen here.
 * Partial success is reported per id; the request itself succeeds.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("leads.write");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 30, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  await ensureMarketingStore();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "stage" && action !== "owner" && action !== "delete") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Deleting requires leads.manage (parity with the single-lead DELETE);
  // owner reassignment likewise (reps cannot hand leads around).
  const needsManage = action === "delete" || action === "owner";
  if (needsManage && !hasCapability(guard.user, "leads.manage")) {
    return NextResponse.json({ error: "leads.manage permission required" }, { status: 403 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string").slice(0, MAX_BATCH)
    : [];
  if (ids.length === 0) return NextResponse.json({ error: "No lead ids given" }, { status: 400 });

  let stage: string | undefined;
  let lostReason: LostReason | undefined;
  let ownerEmail: string | undefined;

  if (action === "stage") {
    stage = typeof body.stage === "string" ? body.stage : undefined;
    if (!isLeadStage(stage)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    lostReason = isLostReason(body.lostReason) ? body.lostReason : undefined;
    if (stage === "lost" && !lostReason && body.lostReason) {
      return NextResponse.json({ error: "Choose a lost reason" }, { status: 400 });
    }
  }
  if (action === "owner") {
    ownerEmail =
      body.ownerEmail === "" || body.ownerEmail === "__unassign__"
        ? ""
        : typeof body.ownerEmail === "string"
          ? body.ownerEmail.trim().slice(0, 200)
          : undefined;
    if (!ownerEmail) return NextResponse.json({ error: "ownerEmail required" }, { status: 400 });
  }

  const results: BatchResult[] = [];
  for (const id of ids) {
    const lead = await getLead(id);
    if (!lead || !canAccessLead(guard.user, lead)) {
      results.push({ id, ok: false, error: "not found" });
      continue;
    }
    try {
      if (action === "stage" && stage) {
        if (stage !== lead.stage) {
          await moveStage(id, stage as never, {
            byEmail: guard.user.email,
            lostReason,
          });
        }
        results.push({ id, ok: true });
      } else if (action === "owner" && ownerEmail !== undefined) {
        await updateLead(
          id,
          { ownerEmail: ownerEmail || undefined },
          guard.user.email,
        );
        results.push({ id, ok: true });
      } else if (action === "delete") {
        const removed = await deleteLead(id);
        results.push(removed ? { id, ok: true } : { id, ok: false, error: "not found" });
      }
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : "failed",
      });
    }
  }

  const done = results.filter((r) => r.ok).length;
  await writeAudit({
    byEmail: guard.user.email,
    action: `lead.batch.${action}`,
    entity: "lead",
    detail: `${done}/${results.length} · ${action}${stage ? ` → ${stage}` : ""}${ownerEmail ? ` → ${ownerEmail}` : ""}`,
    ip: clientIp(req),
  });

  return NextResponse.json({ done, total: results.length, results });
}
