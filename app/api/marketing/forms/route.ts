import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { getForms, saveForms, DEFAULT_FORMS } from "@/lib/marketing/forms";
import { writeAudit } from "@/lib/marketing/audit";
import type { MarketingFormConfig } from "@/lib/marketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/marketing/forms — current configs (admin). */
export async function GET() {
  const guard = await requireCapability("forms.manage");
  if (!guard.ok) return guard.response;
  const forms = await getForms();
  return NextResponse.json({ forms });
}

/** POST /api/marketing/forms — replace form configs (full array). */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("forms.manage");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  let body: { forms?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.forms)) {
    return NextResponse.json({ error: "forms must be an array" }, { status: 400 });
  }
  const forms: MarketingFormConfig[] = body.forms.map((f, i) => sanitizeForm(f, i));
  const saved = await saveForms(forms);
  await writeAudit({ byEmail: guard.user.email, action: "forms.saved", entity: "form", entityId: "all", detail: `${saved.length} configs`, ip: clientIp(req) });
  return NextResponse.json({ forms: saved });
}

/** Reset form configs to the built-in defaults (dev/staging convenience). */
export async function DELETE(req: NextRequest) {
  const guard = await requireCapability("forms.manage");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const forms = await saveForms(DEFAULT_FORMS.map((f) => ({ ...f })));
  await writeAudit({ byEmail: guard.user.email, action: "forms.reset", entity: "form", entityId: "all", ip: clientIp(req) });
  return NextResponse.json({ forms });
}

function sanitizeForm(f: unknown, index: number): MarketingFormConfig {
  const raw = (f ?? {}) as Record<string, unknown>;
  const base = DEFAULT_FORMS[index] ?? DEFAULT_FORMS[0];
  const fields = Array.isArray(raw.fields)
    ? raw.fields
        .map((field) => (field as Record<string, unknown>))
        .filter((field) => typeof field.name === "string" && typeof field.label === "string")
        .map((field) => ({
          name: String(field.name).slice(0, 60),
          label: String(field.label).slice(0, 120),
          type: ["text", "email", "tel", "number", "textarea", "select", "checkbox"].includes(String(field.type))
            ? (String(field.type) as MarketingFormConfig["fields"][number]["type"])
            : "text",
          required: Boolean(field.required),
          options: Array.isArray(field.options) ? field.options.map(String).slice(0, 30) : undefined,
        }))
        .slice(0, 40)
    : base.fields;
  return {
    slug: String(raw.slug ?? base.slug).slice(0, 60),
    name: String(raw.name ?? base.name).slice(0, 120),
    source: String(raw.source ?? base.source).slice(0, 40) as MarketingFormConfig["source"],
    fields,
    destination: ["lead", "email", "lead_and_email", "none"].includes(String(raw.destination))
      ? (String(raw.destination) as MarketingFormConfig["destination"])
      : base.destination,
    notifyEmails: Array.isArray(raw.notifyEmails)
      ? raw.notifyEmails.map(String).slice(0, 5)
      : base.notifyEmails,
    autoReplySubject: typeof raw.autoReplySubject === "string" ? String(raw.autoReplySubject).slice(0, 200) : base.autoReplySubject,
    autoReplyBody: typeof raw.autoReplyBody === "string" ? String(raw.autoReplyBody).slice(0, 2000) : base.autoReplyBody,
    consentRequired: Boolean(raw.consentRequired ?? base.consentRequired),
    thankYou: typeof raw.thankYou === "string" ? String(raw.thankYou).slice(0, 500) : base.thankYou,
    redirectUrl: typeof raw.redirectUrl === "string" ? String(raw.redirectUrl).slice(0, 500) : undefined,
    slim: Boolean(raw.slim ?? base.slim),
    enabled: Boolean(raw.enabled ?? base.enabled),
    updatedAt: new Date().toISOString(),
  };
}