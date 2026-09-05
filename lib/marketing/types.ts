/**
 * Marketing / conversion-center types (server-only).
 *
 * These live in a dedicated namespace, logically separated from the operational
 * PMS data model. A lead becomes a customer only through an explicit conversion
 * that preserves attribution (see `ConvertedCustomer`).
 */

/** Full sales pipeline stages (Phase 12). */
export const PIPELINE_STAGES = [
  "new",
  "qualified",
  "contacted",
  "demo_booked",
  "demo_completed",
  "trial",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type LeadStage = (typeof PIPELINE_STAGES)[number];

export const LEAD_SOURCES = [
  "organic",
  "google_ads",
  "meta_ads",
  "linkedin",
  "youtube",
  "direct",
  "referral",
  "partner",
  "email",
  "whatsapp",
  "blog",
  "pricing_page",
  "feature_page",
  "demo_page",
  "country_page",
  "campaign",
  "other",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface LeadSourceAttribution {
  source?: LeadSource;
  /** Free-form override (e.g. campaign name) when source is "campaign". */
  sourceDetail?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** Full landing URL the visitor converted on. */
  landing?: string;
  /** HTTP referrer (never a stored raw UTM; includes query params only). */
  referrer?: string;
  /** Page path (pathname + query) the conversion happened on. */
  pagePath?: string;
  /** Billing country resolved at capture time (2-letter). */
  country?: string;
}

export interface MarketingLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  propertyName?: string;
  propertyType?: string;
  city?: string;
  country?: string;
  rooms?: number;
  currentPms?: string;
  requiredModules?: string[];
  planInterest?: string;
  billingCycle?: "monthly" | "yearly";
  message?: string;
  source: LeadSource;
  attribution: LeadSourceAttribution;
  stage: LeadStage;
  /** Configurable, additive score (see lib/marketing/scoring.ts). */
  score: number;
  band: "cold" | "warm" | "hot" | "very_hot";
  ownerEmail?: string;
  notes: string[];
  nextFollowUpAt?: string;
  lastContactAt?: string;
  /** Estimated annual contract value in USD (from plan + pricing catalog). */
  estimatedValue: number;
  demoId?: string;
  trialStartedAt?: string;
  lostReason?: string;
  convertedCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadEventType =
  | "created"
  | "stage_changed"
  | "assigned"
  | "note_added"
  | "followup_scheduled"
  | "email_sent"
  | "whatsapp_sent"
  | "call_logged"
  | "demo_booked"
  | "demo_rescheduled"
  | "demo_cancelled"
  | "demo_completed"
  | "trial_started"
  | "proposal_sent"
  | "score_changed"
  | "converted"
  | "reopened";

export interface LeadEvent {
  id: string;
  leadId: string;
  type: LeadEventType;
  at: string;
  byEmail?: string;
  /** Human summary (e.g. "Moved from contacted to demo_booked"). */
  summary: string;
  detail?: string;
}

export const DEMO_STATUSES = [
  "new",
  "confirmed",
  "reschedule_requested",
  "completed",
  "no_show",
  "cancelled",
  "converted",
] as const;

export type DemoStatus = (typeof DEMO_STATUSES)[number];

export interface DemoBooking {
  id: string;
  leadId: string;
  /** ISO datetime of the demo slot (start). */
  startAt: string;
  /** Demo length in minutes. */
  durationMin: number;
  status: DemoStatus;
  assignedTo?: string;
  meetingUrl?: string;
  phone?: string;
  notes?: string;
  city?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  audience?: string;
  country?: string;
  landingPage?: string;
  /** UTM campaign token used in links + captured on leads. */
  utmCampaign?: string;
  startAt?: string;
  endAt?: string;
  budget?: number;
  status: "draft" | "active" | "paused" | "ended";
  createdAt: string;
  updatedAt: string;
}

export type FormDestination = "lead" | "email" | "lead_and_email" | "none";

export interface FormFieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "textarea" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
}

export interface MarketingFormConfig {
  slug: string;
  name: string;
  /** Which lead source this form produces. */
  source: LeadSource;
  fields: FormFieldDef[];
  /** Where submissions are delivered. */
  destination: FormDestination;
  /** Comma-separated recipient emails for notifications. */
  notifyEmails?: string[];
  autoReplySubject?: string;
  autoReplyBody?: string;
  consentRequired?: boolean;
  thankYou: string;
  redirectUrl?: string;
  slim?: boolean;
  enabled: boolean;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  byEmail: string;
  action: string;
  entity: string;
  entityId?: string;
  detail?: string;
  ip?: string;
}

/** Privacy-light page view (no cookie, no raw PII). */
export interface PageView {
  id: string;
  at: string;
  path: string;
  referrer?: string;
  utmCampaign?: string;
  utmSource?: string;
  utmMedium?: string;
  country?: string;
  session: string;
}

/**
 * Record of a marketing lead converting to a paid customer. The conversion
 * preserves all marketing attribution; operational PMS records are NOT created
 * here — that stays the job of the onboarding/billing pipeline.
 */
export interface ConvertedCustomer {
  id: string;
  leadId: string;
  convertedAt: string;
  byEmail?: string;
  plan?: string;
  billingCycle?: "monthly" | "yearly";
  country?: string;
  estimatedValue: number;
  organizationId?: string;
  adminUserId?: string;
  notes?: string;
}