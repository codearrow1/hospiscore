import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import {
  upsertLead,
  updateLead,
  moveStage,
  listLeads,
  type LeadPatch,
} from "@/lib/marketing/leads";
import { parseLeadsCsv } from "@/lib/marketing/pipeline";
import { writeAudit } from "@/lib/marketing/audit";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { isLeadStage } from "@/lib/marketing/stages";
import { LEAD_SOURCES, type LeadSource } from "@/lib/marketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 500;

/**
 * POST /api/marketing/leads/import — { csv: string }
 *
 * Admin-only bulk import. Parses an exported/compatible leads CSV and upserts
 * every row through the SAME dedupe + scoring + event pipeline as a manual
 * create (email → phone → domain). Stage/priority are applied when the file
 * provides them. Returns per-status counts; no DataFile is ever wiped.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("leads.write");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 20, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  await ensureMarketingStore();

  let body: { csv?: string };
  try {
    body = (await req.json()) as { csv?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.csv !== "string" || !body.csv.trim()) {
    return NextResponse.json({ error: "csv is required" }, { status: 400 });
  }

  const parsed = parseLeadsCsv(body.csv);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No rows could be read from the file" }, { status: 400 });
  }
  const rows = parsed.rows.slice(0, MAX_ROWS);

  let created = 0;
  let duplicates = 0;
  let failed = 0;
  const errors: string[] = [];
  const basename = (r: (typeof rows)[number]) =>
    [r.name, r.email, r.propertyName ?? r.company, r.country, r.phone].find(Boolean) ?? "<row>";

  // Pre-seed the dedupe set with existing emails so "matched existing record"
  // (a duplicate) is reported honestly rather than silently re-updated.
  const knownEmails = new Set((await listLeads()).map((l) => l.email));
  const seenInFile = new Set<string>();

  for (const r of rows) {
    const source: LeadSource = (LEAD_SOURCES as readonly string[]).includes(r.source ?? "")
      ? (r.source as LeadSource)
      : "other";
    const emailKey = r.email?.toLowerCase();
    if (emailKey && (knownEmails.has(emailKey) || seenInFile.has(emailKey))) {
      duplicates += 1;
      continue;
    }
    if (emailKey) seenInFile.add(emailKey);
    try {
      const lead = await upsertLead(
        {
          name: r.name ?? "",
          email: r.email ?? "",
          phone: r.phone,
          company: r.company,
          propertyName: r.propertyName,
          propertyType: r.propertyType,
          city: r.city,
          country: r.country,
          rooms: r.rooms,
          currentPms: r.currentPms,
          planInterest: r.planInterest,
          billingCycle: r.billingCycle,
          message: r.message,
          source,
          priority: r.priority,
          byEmail: guard.user.email,
        },
      );
      if (!lead) {
        failed += 1;
        errors.push(`${basename(r)}: name and email (or phone) are required`);
        continue;
      }
      // Apply stage when the file provides one (moveStage logs the transition).
      if (r.stage && r.stage !== lead.stage && isLeadStage(r.stage)) {
        await moveStage(lead.id, r.stage, { byEmail: guard.user.email });
      }
      // Restore exported value/currency (upsert recomputes its own estimate).
      const patch: LeadPatch = {};
      if (typeof r.estimatedValue === "number") patch.estimatedValue = r.estimatedValue;
      if (r.estimatedValueCurrency) patch.estimatedValueCurrency = r.estimatedValueCurrency.toUpperCase();
      if (Object.keys(patch).length > 0) {
        await updateLead(lead.id, patch, guard.user.email);
      }
      created += 1;
    } catch (err) {
      failed += 1;
      errors.push(`${basename(r)}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  if (created > 0) {
    await writeAudit({
      byEmail: guard.user.email,
      action: "lead.import",
      entity: "lead",
      detail: `${created} created${duplicates ? `, ${duplicates} matched existing` : ""}${failed ? `, ${failed} failed` : ""}`,
      ip: clientIp(req),
    });
  }

  return NextResponse.json({
    created,
    duplicates,
    failed,
    totalRows: parsed.rows.length,
    errors: errors.slice(0, 10),
  });
}