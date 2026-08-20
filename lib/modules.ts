import type { IconName } from "@/components/marketing/icons";

/**
 * The full HospiOS PMS module catalogue — 23 modules grouped into 7 operating
 * categories. The online-presence score is deliberately NOT here: it is the
 * free marketing tool that introduces prospects to the platform.
 */

export type ModuleCategoryId =
  | "operations"
  | "guest"
  | "fnb"
  | "backoffice"
  | "finance"
  | "growth"
  | "enterprise";

export interface ModuleCategory {
  id: ModuleCategoryId;
  label: string;
  blurb: string;
  icon: IconName;
}

export interface PmsModule {
  id: string;
  name: string;
  tagline: string;
  bullets: string[];
  category: ModuleCategoryId;
}

export const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    id: "operations",
    label: "Operations",
    blurb: "Front desk, rooms, and reservations — the heartbeat of your property.",
    icon: "dashboard",
  },
  {
    id: "guest",
    label: "Guest Experience",
    blurb: "Delight guests from their first search to their next stay.",
    icon: "guest",
  },
  {
    id: "fnb",
    label: "Food & Beverage",
    blurb: "Restaurant, kitchen, and room service in one POS.",
    icon: "utensils",
  },
  {
    id: "backoffice",
    label: "Back-of-House",
    blurb: "Housekeeping, laundry, maintenance, and inventory in sync.",
    icon: "sparkle",
  },
  {
    id: "finance",
    label: "Finance & People",
    blurb: "Night audit, accounting, payroll, and your team.",
    icon: "coins",
  },
  {
    id: "growth",
    label: "Revenue & Growth",
    blurb: "Sell smarter on every channel and grow direct revenue.",
    icon: "trend",
  },
  {
    id: "enterprise",
    label: "Enterprise & Automation",
    blurb: "Run global groups across brands and currencies, integrate anything, automate with AI.",
    icon: "ai",
  },
];

export const PMS_MODULES: PmsModule[] = [
  {
    id: "dashboard",
    name: "Dashboard & Command Center",
    tagline: "Live KPIs, occupancy, arrivals, housekeeping, and alerts in one real-time view.",
    category: "operations",
    bullets: [
      "Real-time KPIs, occupancy & revenue summary",
      "Live arrivals, departures & pending payments",
      "Housekeeping status, maintenance & OTA sync alerts",
      "Role-based dashboards, widgets & quick actions",
    ],
  },
  {
    id: "frontdesk",
    name: "Front Desk Operations",
    tagline: "Check-ins, walk-ins, group bookings, upgrades, and guest folios in one screen.",
    category: "operations",
    bullets: [
      "Room board with live status & smart color coding",
      "Express & digital check-in / check-out",
      "Walk-in, group & corporate bookings; waitlist & no-shows",
      "VIP management, room moves, upgrades & blacklist",
    ],
  },
  {
    id: "reservations",
    name: "Reservations & Bookings",
    tagline: "Booking wizard, availability calendar, rate plans, and promotions from any source.",
    category: "operations",
    bullets: [
      "Direct, OTA & manual reservations with a booking wizard",
      "Availability calendar, holds, waitlist & timeline",
      "Rate plans, dynamic pricing, promotions & coupons",
      "Modifications, cancellations & auto-confirmations",
    ],
  },
  {
    id: "rooms",
    name: "Room Management",
    tagline: "Room master, categories, amenities, statuses, and inspections with color coding.",
    category: "operations",
    bullets: [
      "Categories, floors, buildings & room master",
      "Room status, OOO / out-of-service & blocking",
      "Amenities, photos & smart room color coding",
      "Inspection & room inventory",
    ],
  },
  {
    id: "crm",
    name: "Guest Management (CRM)",
    tagline: "A full guest profile with stays, preferences, documents, and loyalty — in one timeline.",
    category: "guest",
    bullets: [
      "Guest profile, timeline & stay history",
      "Preferences, travel documents & identity verification",
      "Loyalty, membership, wallet & reviews",
      "Segmentation, VIP tags, campaigns & reminders",
    ],
  },
  {
    id: "selfservice",
    name: "Guest Self-Service Portal",
    tagline: "Guests book, check in, order room service, and manage everything from their phone.",
    category: "guest",
    bullets: [
      "Online booking & digital check-in / check-out",
      "Room service, laundry & housekeeping requests",
      "Concierge, local activities, transfers & taxi",
      "Invoices, payments & loyalty dashboard",
    ],
  },
  {
    id: "bookingengine",
    name: "Website & Booking Engine",
    tagline: "A responsive booking engine with real-time availability and secure payments.",
    category: "guest",
    bullets: [
      "Real-time availability & secure payments",
      "Packages, promo codes & multi-language",
      "Reviews, gallery & virtual tours",
      "SEO-ready with blog & experience booking",
    ],
  },
  {
    id: "comms",
    name: "Communication Center",
    tagline: "Email, WhatsApp, and SMS automations — confirmations, reminders, and review requests.",
    category: "guest",
    bullets: [
      "Email, WhatsApp & SMS channels",
      "Automated confirmations, reminders & review requests",
      "Payment reminders & broadcast announcements",
      "Internal messaging for your team",
    ],
  },
  {
    id: "pos",
    name: "Restaurant & POS",
    tagline: "Table service, KDS, QR menus, and room service — from KOT to settlement.",
    category: "fnb",
    bullets: [
      "POS, kitchen display & table management",
      "QR menu & room service with KOT / BOT",
      "Menu, recipes, combos & modifiers",
      "Split bills, discounts, food cost & reports",
    ],
  },
  {
    id: "housekeeping",
    name: "Housekeeping",
    tagline: "Cleaning schedules, inspections, and readiness — assigned and approved end to end.",
    category: "backoffice",
    bullets: [
      "Schedules, cleaning checklists & deep cleaning",
      "Staff assignment & supervisor approval",
      "Linen management & amenities replenishment",
      "Room readiness & lost & found",
    ],
  },
  {
    id: "laundry",
    name: "Laundry Management",
    tagline: "Guest laundry and hotel linen with pickup, tracking, and billing.",
    category: "backoffice",
    bullets: [
      "Guest laundry & hotel linen",
      "Pickup, delivery & damage reporting",
      "Laundry billing & inventory",
      "Workflow tracking & analytics",
    ],
  },
  {
    id: "maintenance",
    name: "Maintenance Management",
    tagline: "Preventive and corrective work orders with technician and vendor tracking.",
    category: "backoffice",
    bullets: [
      "Preventive & corrective maintenance",
      "Work orders & technician assignment",
      "Vendor, AMC & asset tracking",
      "Cost tracking & maintenance reports",
    ],
  },
  {
    id: "inventory",
    name: "Inventory & Procurement",
    tagline: "Stock, purchase orders, and recipe consumption from goods receipt to valuation.",
    category: "backoffice",
    bullets: [
      "Inventory master & low-stock alerts",
      "Purchase orders & vendor management",
      "Goods receipt & stock transfers",
      "Recipe consumption & stock valuation",
    ],
  },
  {
    id: "finance",
    name: "Finance & Accounting",
    tagline: "Guest folios, GST invoices, night audit, and cash — reconciled and reported.",
    category: "finance",
    bullets: [
      "Guest folio, GST invoices & credit notes",
      "Advances, deposits & refunds",
      "Cash management, expenses & reconciliation",
      "Shift closing, night audit & tax reports",
    ],
  },
  {
    id: "hrms",
    name: "HRMS & Staff Management",
    tagline: "Departments, shifts, rosters, payroll, and performance — your whole team in one place.",
    category: "finance",
    bullets: [
      "Employees, departments & designations",
      "Attendance, shifts, rosters & leave",
      "Payroll, salary structure & incentives",
      "Appraisals, KPIs & role-based permissions",
    ],
  },
  {
    id: "channel",
    name: "Channel Manager & OTA Distribution",
    tagline: "Two-way inventory, rate, and restriction sync across all major OTAs.",
    category: "growth",
    bullets: [
      "Booking.com, Airbnb, Expedia, Agoda, VRBO & more",
      "Two-way inventory, rate & restriction sync",
      "Reservation import, room & rate-plan mapping",
      "Distribution dashboard, sync logs & OTA analytics",
    ],
  },
  {
    id: "revenue",
    name: "Revenue Management",
    tagline: "Dynamic, seasonal, and length-of-stay pricing with AI recommendations.",
    category: "growth",
    bullets: [
      "Dynamic, seasonal & weekend pricing",
      "Occupancy, length-of-stay & festival pricing",
      "Corporate & OTA pricing",
      "AI price recommendations & revenue forecasting",
    ],
  },
  {
    id: "bi",
    name: "Reports & Business Intelligence",
    tagline: "Revenue, occupancy, ADR, RevPAR, and channel performance — as live dashboards.",
    category: "growth",
    bullets: [
      "Revenue, occupancy, ADR & RevPAR",
      "GOPPAR & room performance",
      "Channel, guest & marketing analytics",
      "Forecasting & executive dashboards",
    ],
  },
  {
    id: "marketing",
    name: "Marketing & Loyalty",
    tagline: "Coupons, gift cards, referral programs, and campaigns across every channel.",
    category: "growth",
    bullets: [
      "Coupons, gift cards & promotions",
      "Membership plans & loyalty points",
      "Email, WhatsApp & SMS campaigns",
      "Review management & social integrations",
    ],
  },
  {
    id: "multiproperty",
    name: "Multi-Property Management",
    tagline: "A central dashboard for every property, brand, and team — in your own currency.",
    category: "enterprise",
    bullets: [
      "Centralized dashboard & property switching",
      "Shared users & consolidated reporting",
      "Central CRM & central inventory",
      "Multi-currency pricing, folios & settlement",
      "Brand management & property-specific pricing",
    ],
  },
  {
    id: "security",
    name: "Security & Administration",
    tagline: "Role-based access, activity logs, 2FA, and session controls.",
    category: "enterprise",
    bullets: [
      "Role-based access control",
      "2FA & activity logs",
      "API keys, sessions & device management",
      "Password policies, backups & disaster recovery",
    ],
  },
  {
    id: "api",
    name: "API & Integrations",
    tagline: "A public REST API and webhooks plus payment, calendar, door-lock, and IoT integrations.",
    category: "enterprise",
    bullets: [
      "Payments: Razorpay, Stripe, PayPal & more",
      "Google & Outlook calendar sync",
      "Door locks, IoT & biometric devices",
      "Public REST API & webhooks",
    ],
  },
  {
    id: "ai",
    name: "AI & Automation",
    tagline: "AI concierge, sentiment analysis, pricing recommendations, and predictive operations.",
    category: "enterprise",
    bullets: [
      "AI concierge & chatbot",
      "Guest sentiment & review response generation",
      "Smart room allocation & predictive housekeeping",
      "AI pricing, upselling & inventory forecasting",
    ],
  },
];

export const TOTAL_MODULES = PMS_MODULES.length;
