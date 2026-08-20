/**
 * Marketing pricing: per-room tiered plans with a room-count calculator.
 * Modeled on modern per-room SaaS pricing (start ~$8/room/month).
 */

export interface Plan {
  id: string;
  name: string;
  blurb: string;
  perRoomUsd: number;
  featured?: boolean;
  cta: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "core",
    name: "Core",
    blurb: "For single properties getting off manual systems.",
    perRoomUsd: 8,
    cta: "Book a demo",
    features: [
      "Property Management System (PMS)",
      "Booking engine & availability calendar",
      "Front desk, rooms & daily inventory",
      "Housekeeping & maintenance",
      "Reports & mobile apps (Android + iOS)",
      "Banquet & single-room booking",
      "Free online presence score",
    ],
  },
  {
    id: "flex",
    name: "Flex",
    blurb: "For growing properties selling across channels.",
    perRoomUsd: 12,
    featured: true,
    cta: "Book a demo",
    features: [
      "Everything in Core, plus:",
      "Channel manager — 14+ OTAs",
      "Group room booking & multi-property",
      "Guest CRM, profiles & stay history",
      "Web check-in & guest self-service",
      "Daily rates with bulk edits",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For full-service hotels with restaurant and inventory.",
    perRoomUsd: 20,
    cta: "Book a demo",
    features: [
      "Everything in Flex, plus:",
      "Restaurant POS, KDS & QR menu",
      "Store, inventory & stock management",
      "WhatsApp & communication center",
      "Audit logs & advanced security",
      "AI check-in & AI reply drafts",
      "Expense manager & daily audit",
    ],
  },
  {
    id: "ultra",
    name: "Ultra",
    blurb: "For groups that want AI running the back office.",
    perRoomUsd: 29,
    cta: "Book a demo",
    features: [
      "Everything in Pro, plus:",
      "AI dynamic pricing & revenue manager",
      "AI inventory forecasting",
      "Revenue & market intelligence",
      "SSO, 2FA & activity logs",
      "Public API, webhooks & integrations",
      "Dedicated success manager",
    ],
  },
];

export const ROOM_BANDS = [
  { label: "1–10 rooms", rooms: 8 },
  { label: "11–25 rooms", rooms: 18 },
  { label: "26–50 rooms", rooms: 38 },
  { label: "51–100 rooms", rooms: 75 },
  { label: "101–250 rooms", rooms: 160 },
];

export const BILLING_CYCLES: { id: BillingCycle; label: string; note?: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly", note: "2 months free" },
];

export type BillingCycle = "monthly" | "yearly";

export function planMonthlyCost(plan: Plan, rooms: number, cycle: BillingCycle): number {
  const perMonth = plan.perRoomUsd * rooms;
  return cycle === "yearly" ? Math.round((perMonth * 10) / 12) : perMonth;
}
