/**
 * Marketing integrations catalogue. Canonical, single source of truth.
 *
 * Two consumption layers:
 *  - `INTEGRATION_GROUPS` (category -> name list) — legacy shape used by the
 *    /integrations page.
 *  - `INTEGRATION_CATALOG` (structured items with per-item status) — drives the
 *    homepage integration ecosystem + filters + hover/tap details.
 *
 * TRUTHFULNESS MODEL (do not relax without a code-level integration):
 *  - `supported` = there is a real, wired adapter in the codebase (payments
 *    gateways in lib/saas/adapters map to a wired adapter). These may be
 *    framed as "supported by HospiOS".
 *  - `available` = present in the product/marketing catalogue as a platform
 *    HospiOS can connect to / distribute through (OTAs, channels, calendars,
 *    accounting, communication, hardware). NOT wired customer integrations —
 *    never shown as "connected".
 * No provider is ever described as "connected to your property" on marketing
 * surfaces. "36+" refers to the catalogue count, not live connections — the
 * UI must not say "36+ connected integrations".
 */

export type IntegrationCategory =
  | "otas"
  | "payments"
  | "calendar"
  | "accounting"
  | "comms"
  | "hardware";

export type IntegrationStatus = "supported" | "available";

export interface IntegrationItem {
  id: string;
  name: string;
  category: IntegrationCategory;
  /** supported = real wired adapter; available = catalogue/ecosystem platform. */
  status: IntegrationStatus;
  /** Short one-line role shown in the hover/tap detail. */
  role: string;
  /** Concrete, true capabilities (only where they exist in code). */
  capabilities: string[];
  /** Accent colour token for the wordmark / monogram dot. */
  accent: string; // tailwind text color class
}

export interface IntegrationGroup {
  id: string;
  label: string;
  blurb: string;
  items: string[];
}

const CAT = {
  otas: "otas",
  payments: "payments",
  calendar: "calendar",
  accounting: "accounting",
  comms: "comms",
  hardware: "hardware",
} as const;

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  otas: "OTAs & distribution",
  payments: "Payments & gateways",
  calendar: "Calendars & office",
  accounting: "Accounting & BI",
  comms: "Communication",
  hardware: "Hardware & IoT",
};

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    id: "otas",
    label: "OTAs & distribution",
    blurb: "Two-way inventory, rate, and restriction sync in real time.",
    items: [
      "Booking.com",
      "Airbnb",
      "Expedia",
      "Agoda",
      "Tripadvisor",
      "Google Hotels",
      "MakeMyTrip",
      "Goibibo",
      "Yatra",
      "Cleartrip",
      "Hotelbeds",
      "Trip.com",
      "VRBO",
      "Hostelworld",
    ],
  },
  {
    id: "payments",
    label: "Payments & gateways",
    blurb: "Take and settle payments securely, on every channel.",
    items: ["Razorpay", "Stripe", "PayPal", "PayU", "Cashfree"],
  },
  {
    id: "comms",
    label: "Communication",
    blurb: "Reach guests where they already are.",
    items: ["WhatsApp Business", "Twilio SMS", "SendGrid", "Mailgun", "Slack"],
  },
  {
    id: "calendar",
    label: "Calendars & office",
    blurb: "Keep everyone's schedule in sync.",
    items: ["Google Calendar", "Outlook Calendar", "Microsoft 365"],
  },
  {
    id: "hardware",
    label: "Hardware & IoT",
    blurb: "Connect the physical property.",
    items: ["Assa Abloy Locks", "Salto", "Biometric Devices", "Printer Servers"],
  },
  {
    id: "accounting",
    label: "Accounting & BI",
    blurb: "Export clean books and dashboards.",
    items: ["Tally", "QuickBooks", "Xero", "Power BI", "Google Sheets"],
  },
];

export const TOTAL_INTEGRATIONS = INTEGRATION_GROUPS.reduce(
  (sum, g) => sum + g.items.length,
  0,
);

/** Flat name list used by the legacy integrations bar (kept for compat). */
export const INTEGRATION_LOGOS = INTEGRATION_GROUPS.flatMap((g) => g.items);

/**
 * Structured catalogue. Payment gateways marked `supported` reflect real wired
 * adapters (lib/saas/adapters/<id>.ts exists and is wired). All other platforms
 * are `available` ecosystem entries (never "connected").
 */
export const INTEGRATION_CATALOG: IntegrationItem[] = [
  // ---- OTAs & distribution (available ecosystem) ----
  { id: "booking", name: "Booking.com", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates", "Restrictions", "Reservations"], accent: "text-blue-300" },
  { id: "airbnb", name: "Airbnb", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Calendar sync", "Listing sync", "Messaging"], accent: "text-rose-300" },
  { id: "expedia", name: "Expedia", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates", "Reservations"], accent: "text-indigo-300" },
  { id: "agoda", name: "Agoda", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates", "Restrictions"], accent: "text-sky-300" },
  { id: "tripadvisor", name: "Tripadvisor", category: CAT.otas, status: "available", role: "Reviews & presence", capabilities: ["Review signals", "Reputation data"], accent: "text-emerald-300" },
  { id: "google-hotels", name: "Google Hotels", category: CAT.otas, status: "available", role: "Travel distribution", capabilities: ["Availability", "Pricing", "Ads"], accent: "text-amber-300" },
  { id: "makemytrip", name: "MakeMyTrip", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates", "Reservations"], accent: "text-cyan-300" },
  { id: "goibibo", name: "Goibibo", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates"], accent: "text-sky-300" },
  { id: "yatra", name: "Yatra", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates"], accent: "text-blue-300" },
  { id: "cleartrip", name: "Cleartrip", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates"], accent: "text-orange-300" },
  { id: "hotelbeds", name: "Hotelbeds", category: CAT.otas, status: "available", role: "Distribution / B2B", capabilities: ["Rate loading", "Inventory", "B2B channels"], accent: "text-violet-300" },
  { id: "tripcom", name: "Trip.com", category: CAT.otas, status: "available", role: "OTA distribution", capabilities: ["Inventory", "Rates", "Reservations"], accent: "text-blue-300" },
  { id: "vrbo", name: "VRBO", category: CAT.otas, status: "available", role: "Vacation rental", capabilities: ["Calendar sync", "Listing sync"], accent: "text-red-300" },
  { id: "hostelworld", name: "Hostelworld", category: CAT.otas, status: "available", role: "Hostel distribution", capabilities: ["Inventory", "Rates", "Bednight sync"], accent: "text-amber-200" },

  // ---- Payments (supported = real wired adapters) ----
  { id: "stripe", name: "Stripe", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Refunds", "Webhooks"], accent: "text-indigo-300" },
  { id: "razorpay", name: "Razorpay", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Refunds", "Webhooks"], accent: "text-cyan-300" },
  { id: "paypal", name: "PayPal", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Refunds", "Webhooks"], accent: "text-sky-300" },
  { id: "payu", name: "PayU", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Settlement webhooks"], accent: "text-orange-300" },
  { id: "cashfree", name: "Cashfree", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Refunds", "Webhooks"], accent: "text-emerald-300" },
  { id: "adyen", name: "Adyen", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Refunds", "Webhooks"], accent: "text-indigo-300" },
  { id: "checkout", name: "Checkout.com", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Refunds", "Webhooks"], accent: "text-blue-300" },
  { id: "square", name: "Square", category: CAT.payments, status: "supported", role: "Payment gateway", capabilities: ["Payments", "Refunds", "Webhooks"], accent: "text-zinc-200" },

  // ---- Communication (available ecosystem) ----
  { id: "whatsapp", name: "WhatsApp Business", category: CAT.comms, status: "available", role: "Guest messaging", capabilities: ["Guests", "Automation", "Notify"], accent: "text-green-300" },
  { id: "twilio", name: "Twilio SMS", category: CAT.comms, status: "available", role: "SMS & alerts", capabilities: ["SMS", "Alerts", "Verify"], accent: "text-red-300" },
  { id: "sendgrid", name: "SendGrid", category: CAT.comms, status: "available", role: "Email delivery", capabilities: ["Transactional email", "Templates"], accent: "text-sky-300" },
  { id: "mailgun", name: "Mailgun", category: CAT.comms, status: "available", role: "Email delivery", capabilities: ["Transactional email", "Webhooks"], accent: "text-violet-300" },
  { id: "slack", name: "Slack", category: CAT.comms, status: "available", role: "Team notifications", capabilities: ["Alerts", "Webhooks"], accent: "text-fuchsia-300" },

  // ---- Calendars & office (available ecosystem) ----
  { id: "gcal", name: "Google Calendar", category: CAT.calendar, status: "available", role: "Calendar sync", capabilities: ["Availability", "Events", "Staff"], accent: "text-blue-300" },
  { id: "outlook", name: "Outlook Calendar", category: CAT.calendar, status: "available", role: "Calendar sync", capabilities: ["Availability", "Events", "Staff"], accent: "text-sky-300" },
  { id: "m365", name: "Microsoft 365", category: CAT.calendar, status: "available", role: "Productivity suite", capabilities: ["Calendar", "Mail", "Teams"], accent: "text-indigo-300" },

  // ---- Hardware & IoT (available ecosystem) ----
  { id: "assa", name: "Assa Abloy Locks", category: CAT.hardware, status: "available", role: "Door access", capabilities: ["Keys", "Access", "Audit"], accent: "text-violet-300" },
  { id: "salto", name: "Salto", category: CAT.hardware, status: "available", role: "Door access", capabilities: ["Keys", "Access", "Audit"], accent: "text-emerald-300" },
  { id: "biometric", name: "Biometric Devices", category: CAT.hardware, status: "available", role: "Staff access", capabilities: ["Attendance", "Access control"], accent: "text-cyan-300" },
  { id: "printers", name: "Printer Servers", category: CAT.hardware, status: "available", role: "POS & receipts", capabilities: ["Receipts", "Labels", "Kitchen tickets"], accent: "text-zinc-300" },

  // ---- Accounting & BI (available ecosystem) ----
  { id: "tally", name: "Tally", category: CAT.accounting, status: "available", role: "Accounting suite", capabilities: ["Book export", "GST-ready", "Ledgers"], accent: "text-orange-300" },
  { id: "quickbooks", name: "QuickBooks", category: CAT.accounting, status: "available", role: "Accounting suite", capabilities: ["Book export", "Invoices", "Ledgers"], accent: "text-emerald-300" },
  { id: "xero", name: "Xero", category: CAT.accounting, status: "available", role: "Accounting suite", capabilities: ["Book export", "Invoices", "Ledgers"], accent: "text-sky-300" },
  { id: "powerbi", name: "Power BI", category: CAT.accounting, status: "available", role: "Business intelligence", capabilities: ["Dashboards", "Analytics export"], accent: "text-amber-300" },
  { id: "sheets", name: "Google Sheets", category: CAT.accounting, status: "available", role: "BI / reporting", capabilities: ["Exports", "Reports", "Sync"], accent: "text-green-300" },
];

const CATALOG_BY_ID = new Map<string, IntegrationItem>(
  INTEGRATION_CATALOG.map((i) => [i.id, i]),
);

export function integrationItem(id: string): IntegrationItem | undefined {
  return CATALOG_BY_ID.get(id);
}

/** Categories that genuinely have a real wired adapter in the codebase. */
export const SUPPORTED_CATEGORIES: IntegrationCategory[] = ["payments"];

/** Count of catalogue entries that map to a real wired adapter. */
export const SUPPORTED_COUNT = INTEGRATION_CATALOG.filter(
  (i) => i.status === "supported",
).length;

/** All items in a category. */
export function integrationsByCategory(
  category: IntegrationCategory,
): IntegrationItem[] {
  return INTEGRATION_CATALOG.filter((i) => i.category === category);
}