/**
 * Plan catalog. Defines the five standard plans, their limits and the shared
 * feature matrix. Prices are NOT here — they live in the pricing database
 * (`defaults.ts` / `db.ts`) per country.
 */
import type { PlanId } from "./types";

export const PLAN_IDS: readonly PlanId[] = [
  "solopreneur",
  "starter",
  "growth",
  "professional",
  "enterprise",
];

export const PLAN_ORDER: readonly PlanId[] = PLAN_IDS;

export interface PlanCatalogEntry {
  id: PlanId;
  name: string;
  /** Short target audience shown on the card ("For independent properties"). */
  tagline: string;
  /** Subtle descriptor, e.g. "Best for small properties". */
  descriptor: string;
  /** Room range (inclusive, upper bound null = custom/unlimited). */
  roomMin: number;
  roomMax: number | null;
  /** Account limits. Null = custom/unlimited. */
  adminLimit: number | null;
  staffLimit: number | null;
  /** CTA label. Enterprise uses "Talk to Sales". */
  cta: string;
  /** Featured "Most Popular" plan. */
  featured?: boolean;
  /** Card bullets (concise, grouped). The first entry may say "Everything in X, plus:". */
  cardFeatures: string[];
}

export const PLANS: readonly PlanCatalogEntry[] = [
  {
    id: "solopreneur",
    name: "Solopreneur",
    tagline: "For independent hospitality businesses",
    descriptor: "Best for small properties",
    roomMin: 1,
    roomMax: 6,
    adminLimit: 1,
    staffLimit: 5,
    cta: "Book a demo",
    cardFeatures: [
      "Front desk, reservations & room board",
      "Booking calendar & availability",
      "Guest profiles & check-in / check-out",
      "Housekeeping & maintenance",
      "Basic billing & invoices",
      "Direct booking page",
      "Email + WhatsApp notifications",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For small hotels & growing guesthouses",
    descriptor: "Best for growing properties",
    roomMin: 7,
    roomMax: 15,
    adminLimit: 2,
    staffLimit: 10,
    cta: "Book a demo",
    cardFeatures: [
      "Everything in Solopreneur, plus:",
      "Channel manager — 14+ OTAs (Booking.com, Expedia, Airbnb)",
      "Rate plans, promotions & promo codes",
      "Automated booking confirmations & guest messages",
      "Advanced housekeeping & maintenance workflows",
      "Occupancy & revenue reports",
      "Staff roles, permissions & attendance",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing hotels with multiple departments",
    descriptor: "Best for full operations",
    roomMin: 16,
    roomMax: 40,
    adminLimit: 5,
    staffLimit: 25,
    cta: "Book a demo",
    featured: true,
    cardFeatures: [
      "Everything in Starter, plus:",
      "Revenue dashboard — ADR, RevPAR & forecasting",
      "Guest CRM, segmentation & repeat-guest tracking",
      "WhatsApp communication center",
      "Daily revenue audit & payment reconciliation",
      "Department & shift management",
      "Direct booking engine, coupons & promotions",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "For full-service hotels, resorts & larger properties",
    descriptor: "Best for complex operations",
    roomMin: 41,
    roomMax: 100,
    adminLimit: 10,
    staffLimit: 75,
    cta: "Book a demo",
    cardFeatures: [
      "Everything in Growth, plus:",
      "Restaurant POS, tables, KDS & QR menus",
      "Inventory, purchasing & supplier management",
      "P&L, cash flow & financial dashboards",
      "Payment gateways, accounting & API / webhooks",
      "AI guest replies, booking & demand forecasting",
      "Tax configuration & department accounting",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For hotel groups, chains & multi-property operators",
    descriptor: "Custom scope & scale",
    roomMin: 101,
    roomMax: null,
    adminLimit: null,
    staffLimit: null,
    cta: "Talk to Sales",
    cardFeatures: [
      "Everything in Professional, plus:",
      "Central reservation system & group dashboards",
      "Central finance, inventory & brand analytics",
      "Advanced role-based access & SSO",
      "API, webhooks & custom integrations",
      "Dedicated account manager, SLA & onboarding",
      "Data migration & custom AI capabilities",
    ],
  },
];

export function getPlan(id: string): PlanCatalogEntry | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Plan availability in the compare matrix: Included / Advanced / Add-on / Enterprise / —. */
export type FeatureLevel = "included" | "advanced" | "addon" | "enterprise" | null;

export interface CompareRow {
  label: string;
  levels: Record<PlanId, FeatureLevel>;
}

/** Shared feature matrix (spec-driven). `null` renders as an em-dash. */
export const FEATURE_MATRIX: readonly CompareRow[] = [
  { label: "Property management", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Booking calendar", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Guest management", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Check-in / check-out", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Housekeeping & maintenance", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Billing & invoices", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Expenses", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Reports & occupancy", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Direct booking page / engine", levels: { solopreneur: "included", starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "OTA / channel manager (14+)", levels: { solopreneur: null, starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Booking.com · Expedia · Airbnb", levels: { solopreneur: null, starter: "included", growth: "included", professional: "included", enterprise: "included" } },
  { label: "Guest CRM & segmentation", levels: { solopreneur: null, starter: null, growth: "included", professional: "included", enterprise: "included" } },
  { label: "WhatsApp & communication", levels: { solopreneur: "addon", starter: "included", growth: "advanced", professional: "advanced", enterprise: "advanced" } },
  { label: "Revenue analytics · ADR · RevPAR", levels: { solopreneur: null, starter: null, growth: "included", professional: "advanced", enterprise: "advanced" } },
  { label: "Revenue forecasting", levels: { solopreneur: null, starter: null, growth: "included", professional: "advanced", enterprise: "advanced" } },
  { label: "Restaurant POS · KDS · QR menu", levels: { solopreneur: null, starter: null, growth: null, professional: "included", enterprise: "included" } },
  { label: "Inventory & purchasing", levels: { solopreneur: null, starter: null, growth: null, professional: "included", enterprise: "advanced" } },
  { label: "Supplier management", levels: { solopreneur: null, starter: null, growth: null, professional: "included", enterprise: "advanced" } },
  { label: "AI guest assistant", levels: { solopreneur: null, starter: null, growth: null, professional: "included", enterprise: "advanced" } },
  { label: "AI revenue management & forecasting", levels: { solopreneur: null, starter: null, growth: null, professional: "included", enterprise: "advanced" } },
  { label: "API & webhooks", levels: { solopreneur: null, starter: null, growth: null, professional: "included", enterprise: "included" } },
  { label: "SSO", levels: { solopreneur: null, starter: null, growth: null, professional: null, enterprise: "included" } },
  { label: "Multi-property & central reservation", levels: { solopreneur: null, starter: null, growth: null, professional: null, enterprise: "included" } },
  { label: "Dedicated account manager", levels: { solopreneur: null, starter: null, growth: null, professional: null, enterprise: "included" } },
];

export const LEVEL_LABELS: Record<Exclude<FeatureLevel, null>, string> = {
  included: "Included",
  advanced: "Advanced",
  addon: "Add-on",
  enterprise: "Enterprise",
};

/** Room-count → recommended plan (calculator + "which plan" guidance). */
export const ROOM_RECOMMENDATIONS: readonly {
  min: number;
  max: number | null;
  plan: PlanId;
}[] = [
  { min: 1, max: 6, plan: "solopreneur" },
  { min: 7, max: 15, plan: "starter" },
  { min: 16, max: 40, plan: "growth" },
  { min: 41, max: 100, plan: "professional" },
  { min: 101, max: null, plan: "enterprise" },
];

/** What every plan includes (marketing truth, no invented claims). */
export const EVERY_PLAN_INCLUDES = [
  "Free online presence score",
  "Free walkthrough for your property",
  "Free property setup & data migration",
  "Mobile-responsive interface (Android + iOS)",
  "Standard support",
  "Cancel or change plans anytime",
];

/** Pricing-page FAQ (also emitted as FAQPage JSON-LD). */
export const PRICING_FAQS = [
  {
    q: "Why does pricing vary by country?",
    a: "HospiOS uses localized pricing: prices are set per market based on local purchasing power and market conditions — not on daily exchange rates. The price you see is the price for the billing country you select.",
  },
  {
    q: "How is the price determined?",
    a: "Your billing country determines the price shown at checkout. You can change the country manually; the final price is always validated from our side when you book, so the price you pay matches the plan and region you subscribe to.",
  },
  {
    q: "Are taxes included in the prices shown?",
    a: "We show tax handling for each country — some prices include local tax (for example GST in India) and others are shown before local taxes. The tax note on this page reflects the billing country you have selected.",
  },
  {
    q: "Do you offer yearly billing?",
    a: "Yes. Yearly billing is available on every plan and is configured per country — it typically equals ten months of the monthly price, so you save about two months per year.",
  },
  {
    q: "Can I switch plans later?",
    a: "Anytime. Move between Solopreneur, Starter, Growth, Professional and Enterprise as you grow — modules switch on or off without losing any of your data.",
  },
  {
    q: "Do I need to sign a contract?",
    a: "No lock-in. Plans are month-to-month, and enterprise groups can add custom SLAs and dedicated support on request.",
  },
];