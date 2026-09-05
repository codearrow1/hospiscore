/**
 * Marketing form manager (Phase 15) + automatic lead capture (Phase 16).
 *
 * Public forms submit to `/api/marketing/forms/[slug]`; the config below
 * drives field validation, destinations, auto-replies and thank-you copy, so
 * changing a form is a config change (editable in the admin), not a code
 * change. Every submission upserts a MarketingLead with full attribution.
 */

import { readData, writeData } from "@/lib/db";
import { CONFIG } from "@/lib/config";
import { sendMail } from "@/lib/mailer";
import { writeAudit } from "./audit";
import { upsertLead, type UpsertInput } from "./leads";
import type {
  LeadSource,
  LeadSourceAttribution,
  MarketingFormConfig,
} from "./types";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+\d][\d\s().-]{6,19}$/;

export const DEFAULT_FORMS: MarketingFormConfig[] = [
  {
    slug: "demo",
    name: "Book a demo",
    source: "demo_page",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Work email", type: "email", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "propertyName", label: "Property name", type: "text" },
      { name: "city", label: "City", type: "text" },
      { name: "country", label: "Country (2-letter code)", type: "text" },
      { name: "phone", label: "Phone / WhatsApp", type: "tel" },
      { name: "rooms", label: "Number of rooms", type: "number" },
      {
        name: "propertyType",
        label: "Property type",
        type: "select",
        options: [
          "Hotel",
          "Resort",
          "Homestay",
          "Villa",
          "Hostel",
          "Boutique hotel",
          "Serviced apartment",
          "Hotel group / chain",
          "Other",
        ],
      },
      { name: "currentPms", label: "Current PMS", type: "text" },
      { name: "preferredDate", label: "Preferred date", type: "text" },
      {
        name: "preferredTime",
        label: "Preferred time",
        type: "select",
        options: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
      },
      { name: "message", label: "Anything we should know?", type: "textarea" },
    ],
    destination: "lead_and_email",
    notifyEmails: [CONFIG.salesEmail],
    autoReplySubject: "Your HospiOS demo request",
    autoReplyBody:
      "Hi {{name}}, thanks for requesting a demo of HospiOS. Our team will reach out shortly to confirm a convenient time. Meanwhile, explore what is included at https://thebuddharice.online/pricing.",
    consentRequired: true,
    thankYou:
      "Thanks! Your demo request is in. Expect a confirmation from our team within one business day.",
    redirectUrl: undefined,
    slim: true,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    slug: "contact",
    name: "Contact us",
    source: "direct",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "message", label: "Message", type: "textarea", required: true },
    ],
    destination: "lead_and_email",
    notifyEmails: [CONFIG.salesEmail],
    autoReplySubject: "We received your message",
    autoReplyBody:
      "Hi {{name}}, thank you for contacting HospiOS. We usually reply within one business day. \n\nYour message: {{message}}",
    consentRequired: true,
    thankYou: "Thanks for getting in touch — we will reply within one business day.",
    slim: false,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    slug: "trial",
    name: "Start a trial",
    source: "pricing_page",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Work email", type: "email", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "propertyName", label: "Property name", type: "text" },
      { name: "rooms", label: "Number of rooms", type: "number" },
    ],
    destination: "lead_and_email",
    notifyEmails: [CONFIG.salesEmail],
    autoReplySubject: "Your HospiOS trial",
    autoReplyBody:
      "Hi {{name}}, welcome to your HospiOS trial. Your team can help you get set up at the time you choose.",
    consentRequired: true,
    thankYou: "You are all set for your trial.",
    slim: true,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    slug: "newsletter",
    name: "Newsletter",
    source: "blog",
    fields: [
      { name: "name", label: "First name", type: "text" },
      { name: "email", label: "Email", type: "email", required: true },
    ],
    destination: "lead",
    notifyEmails: [],
    autoReplySubject: "Welcome to the HospiOS newsletter",
    autoReplyBody:
      "Hi {{name}}, thanks for subscribing. We will send product updates a few times a month.",
    consentRequired: true,
    thankYou: "You are subscribed.",
    slim: true,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    slug: "pricing-consultation",
    name: "Pricing consultation",
    source: "pricing_page",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Work email", type: "email", required: true },
      { name: "country", label: "Country (2-letter code)", type: "text" },
      { name: "rooms", label: "Number of rooms", type: "number" },
      {
        name: "planInterest",
        label: "Plan you are considering",
        type: "select",
        options: ["Solopreneur", "Starter", "Growth", "Professional", "Enterprise"],
      },
    ],
    destination: "lead_and_email",
    notifyEmails: [CONFIG.salesEmail],
    autoReplySubject: "Your pricing consultation",
    autoReplyBody:
      "Hi {{name}}, we received your pricing consultation request and will be in touch shortly.",
    consentRequired: true,
    thankYou: "Thanks — our team will help you choose the right plan.",
    slim: true,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    slug: "enterprise",
    name: "Enterprise inquiry",
    source: "campaign",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Work email", type: "email", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "rooms", label: "Number of rooms", type: "number" },
      { name: "message", label: "Tell us about your group or chain", type: "textarea" },
    ],
    destination: "lead_and_email",
    notifyEmails: [CONFIG.salesEmail],
    autoReplySubject: "Your enterprise inquiry",
    autoReplyBody:
      "Hi {{name}}, thank you for your enterprise inquiry. Our team will be in touch to explore how HospiOS supports multi-property and group operations.",
    consentRequired: true,
    thankYou: "Thanks — the enterprise team will contact you.",
    slim: true,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  },
  {
    slug: "partner",
    name: "Partner inquiry",
    source: "referral",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Work email", type: "email", required: true },
      { name: "company", label: "Company", type: "text" },
      { name: "message", label: "Partnership type interested in", type: "textarea" },
    ],
    destination: "lead_and_email",
    notifyEmails: [CONFIG.salesEmail],
    autoReplySubject: "Your partner inquiry",
    autoReplyBody:
      "Hi {{name}}, thanks for your interest in partnering with HospiOS. The partnerships team will reach out.",
    consentRequired: true,
    thankYou: "Thanks — our partnerships team will follow up.",
    slim: true,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  },
];

export async function getForms(target?: string): Promise<MarketingFormConfig[]> {
  const data = await readData(target);
  return data.forms?.length ? data.forms : DEFAULT_FORMS;
}

export async function getForm(slug: string, target?: string): Promise<MarketingFormConfig | null> {
  const forms = await getForms(target);
  return forms.find((f) => f.slug === slug && f.enabled) ?? null;
}

export async function saveForms(
  forms: MarketingFormConfig[],
  maybe: { target?: string; _preserve?: boolean } = {},
): Promise<MarketingFormConfig[]> {
  const next: MarketingFormConfig[] = forms.map((f) => ({
    ...f,
    updatedAt: new Date().toISOString(),
  }));
  await writeData(
    (d) => ({ ...d, forms: next }),
    maybe.target,
  );
  return next;
}

export function validateFormFields(
  config: MarketingFormConfig,
  values: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  const required = config.fields.filter((f) => f.required);
  for (const f of required) {
    const v = (values[f.name] ?? "").toString().trim();
    if (!v) return { ok: false, error: `${f.label} is required` };
    if (f.type === "email" && !EMAIL_RE.test(v)) {
      return { ok: false, error: `Enter a valid email for ${f.label}` };
    }
  }
  const email = values.email ? values.email.toString() : "";
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address" };
  const phone = values.phone ? values.phone.toString() : "";
  if (phone && !PHONE_RE.test(phone)) return { ok: false, error: "Enter a valid phone number" };
  const rooms = values.rooms;
  if (rooms != null && rooms !== "" && (typeof rooms !== "number" || rooms < 1 || rooms > 10_000)) {
    return { ok: false, error: "Rooms must be between 1 and 10,000" };
  }
  if (config.consentRequired && values.consent !== true && values.consent !== "true" && values.consent !== "on") {
    return { ok: false, error: "Please accept the privacy consent" };
  }
  return { ok: true };
}

export interface SubmissionMeta {
  source?: LeadSource;
  sourceDetail?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landing?: string;
  referrer?: string;
  pagePath?: string;
  country?: string;
  byEmail?: string;
  ip?: string;
}

export interface FormSubmission {
  ok: boolean;
  error?: string;
  leadId?: string;
  thankYou?: string;
  redirectUrl?: string;
  config?: MarketingFormConfig;
}

/** Rewrite demo-form plan/country/cycle context into lead fields. */
function pickList(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map((x) => x.toString());
  if (typeof v === "string" && v) return v.split(",").map((x) => x.trim()).filter(Boolean);
  return undefined;
}

/**
 * Process a submitted form: validate against config, upsert a lead with
 * attribution, honor the destination (auto-reply + team notification), and
 * record an audit entry. Errors never throw past this boundary.
 */
export async function handleFormSubmission(
  slug: string,
  raw: Record<string, unknown>,
  meta: SubmissionMeta = {},
  target?: string,
): Promise<FormSubmission> {
  const config = await getForm(slug, target);
  if (!config) return { ok: false, error: "Unknown form" };

  // Honeypot: a filled hidden field marks an automated bot.
  const honey = raw.__honey;
  if (honey && honey !== "hs-ok-3f9") {
    return { ok: false, error: "Submission rejected" };
  }

  const check = validateFormFields(config, raw);
  if (!check.ok) return { ok: false, error: check.error };

  const attribution: LeadSourceAttribution = {
    source: meta.source ?? config.source,
    sourceDetail: meta.sourceDetail,
    medium: meta.medium,
    campaign: meta.campaign,
    content: meta.content,
    term: meta.term,
    landing: meta.landing,
    referrer: meta.referrer,
    pagePath: meta.pagePath,
    country: meta.country,
  };

  const input: UpsertInput = {
    name: raw.name?.toString().trim() || "",
    email: (raw.email?.toString().trim() || "").toLowerCase(),
    phone: raw.phone ? raw.phone.toString().trim() : undefined,
    company: raw.company ? raw.company.toString().trim() : undefined,
    propertyName: raw.propertyName ? raw.propertyName.toString().trim() : undefined,
    propertyType: raw.propertyType ? raw.propertyType.toString().trim() : undefined,
    city: raw.city ? raw.city.toString().trim() : undefined,
    country:
      (meta.country ?? (raw.country ? raw.country.toString().trim().toUpperCase() : undefined)) || undefined,
    rooms: typeof raw.rooms === "number" ? raw.rooms : raw.rooms ? Number(raw.rooms) : undefined,
    currentPms: raw.currentPms ? raw.currentPms.toString().trim() : undefined,
    requiredModules: pickList(raw.modules),
    planInterest: raw.planInterest ? raw.planInterest.toString().trim() : undefined,
    billingCycle: raw.billingCycle === "yearly" || raw.billingCycle === "monthly" ? raw.billingCycle : undefined,
    message: raw.message ? raw.message.toString().trim() : undefined,
    source: attribution.source ?? "other",
    attribution,
    byEmail: meta.byEmail,
  };

  const lead = await upsertLead(input, target);
  if (!lead) return { ok: false, error: "Could not save the lead" };

  if (meta.byEmail) {
    await writeAudit(
      {
        byEmail: meta.byEmail,
        action: "form.submitted",
        entity: "form",
        entityId: slug,
        detail: `Lead ${lead.id}`,
        ip: meta.ip,
      },
      target,
    ).catch(() => undefined);
  }

  const wantsEmail = config.destination === "email" || config.destination === "lead_and_email";
  const autoReply = config.autoReplySubject && config.autoReplyBody ? sendAutoReply(config, raw) : undefined;

  if (wantsEmail && config.notifyEmails?.length) {
    const subject = `New ${config.name}: ${lead.name} (${lead.country ?? "?"})`;
    const body = renderSimple(
      `New ${config.name} submitted on the website.\n\nName: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone ?? "—"}\nCountry: ${lead.country ?? "—"}\nRooms: ${lead.rooms ?? "—"}\nPlan: ${lead.planInterest ?? lead.billingCycle ?? "—"}\nSource: ${lead.source}\nCampaign: ${lead.attribution.campaign ?? "—"}\nLanding: ${lead.attribution.pagePath ?? "—"}\n\nhttps://thebuddharice.online/marketing-admin/leads/${lead.id}`,
      raw,
    );
    for (const to of config.notifyEmails) {
      sendMail({ to, subject, html: escapeHtml(body).replace(/\n/g, "<br/>") }).catch(() => undefined);
    }
  }
  if (config.autoReplyBody && lead.email) {
    sendMail({
      to: lead.email,
      subject: autoReply?.subject ?? "Thank you",
      html: escapeHtml(autoReply?.body ?? config.autoReplyBody).replace(/\n/g, "<br/>"),
    }).catch(() => undefined);
  }

  return {
    ok: true,
    leadId: lead.id,
    thankYou: config.thankYou,
    redirectUrl: config.redirectUrl,
    config,
  };
}

function sendAutoReply(
  config: MarketingFormConfig,
  raw: Record<string, unknown>,
): { subject: string; body: string } {
  return {
    subject: renderSimple(config.autoReplySubject ?? "Thank you", raw),
    body: renderSimple(config.autoReplyBody ?? "", raw),
  };
}

function renderSimple(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    values[key] ? String(values[key]) : "",
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}