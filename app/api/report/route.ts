import { NextRequest, NextResponse } from "next/server";
import { originAllowed, rateLimit, clientIp } from "@/lib/marketing/guard";
import {
  submitReportRequest,
  validateReportInput,
  type ReportRequestInput,
} from "@/lib/reportRequest";
import { resolvePropertyById } from "@/lib/resolver";
import { computeScore } from "@/lib/scoring";
import { buildReport } from "@/lib/report";
import { buildReportEmail } from "@/lib/reportEmail";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/report { name, email, propertySlug }
 *
 * Emails the full score report for a property to the given address and stores
 * the request as a sales lead. Returns 200 with the lead id and whether the
 * e-mail was dispatched (console transport always reports sent), 400 on
 * validation failure, 404 when the property is unknown.
 */
export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: "Rejected" }, { status: 403 });
  }
  // Public endpoint that sends e-mail to a caller-supplied address: throttle
  // per client to blunt scripted/abusive report generation.
  if (!rateLimit(`report:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let body: Partial<ReportRequestInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const check = validateReportInput(body);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const property = await resolvePropertyById(body.propertySlug!);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const result = computeScore(property.signals);
  const report = buildReport(property.name, property.signals);
  const record = await submitReportRequest(
    { name: body.name, email: body.email, phone: body.phone, propertySlug: body.propertySlug },
    property.name,
  );

  let emailed = true;
  try {
    const email = buildReportEmail({ property, result, report });
    await sendMail({ to: record.email, subject: email.subject, html: email.html });
  } catch (err) {
    emailed = false;
    console.error("Report e-mail dispatch failed:", err);
  }

  return NextResponse.json({
    ok: true,
    id: record.id,
    propertyName: property.name,
    score: result.overall,
    emailed,
  });
}
