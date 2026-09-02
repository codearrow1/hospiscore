import type { IconName } from "@/components/marketing/icons";

/**
 * Marketing solution pages (property types). Rich content for the
 * /solutions/[slug] pages, the home-page property showcase, and the solutions
 * strip. Single canonical source — other components consume this, never copy it.
 */

export type PropertyAccent =
  | "indigo"
  | "teal"
  | "magenta"
  | "orange"
  | "blue"
  | "emerald"
  | "amber"
  | "sky";

/** Map a semantic property accent to Tailwind classes (badge / glow / active). */
export const ACCENT_TEXT: Record<PropertyAccent, string> = {
  indigo: "text-indigo-300",
  teal: "text-teal-300",
  magenta: "text-fuchsia-300",
  orange: "text-orange-300",
  blue: "text-sky-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  sky: "text-cyan-300",
};

export const ACCENT_BG: Record<PropertyAccent, string> = {
  indigo: "bg-indigo-500/15",
  teal: "bg-teal-500/15",
  magenta: "bg-fuchsia-500/15",
  orange: "bg-orange-500/15",
  blue: "bg-sky-500/15",
  emerald: "bg-emerald-500/15",
  amber: "bg-amber-500/15",
  sky: "bg-cyan-500/15",
};

export const ACCENT_GLOW: Record<PropertyAccent, string> = {
  indigo: "via-indigo-500/20",
  teal: "via-teal-500/20",
  magenta: "via-fuchsia-500/20",
  orange: "via-orange-500/20",
  blue: "via-sky-500/20",
  emerald: "via-emerald-500/20",
  amber: "via-amber-500/20",
  sky: "via-cyan-500/20",
};

export interface Solution {
  slug: string;
  name: string;
  tagline: string;
  headline: string;
  intro: string;
  icon: IconName;
  /** Photographic visual for the home-page showcase (curated Unsplash source). */
  image: string;
  /** Image alt text (human-written, descriptive of the property type). */
  imageAlt: string;
  /** Semantic accent used for badge, glow, active state + CTA highlight. */
  accent: PropertyAccent;
  /** Who this property type is for — one short line. */
  audience: string;
  /** Primary value proposition — how HospiOS is different for this property. */
  value: string;
  /** 3–4 human-facing capabilities (not the raw module chip list). */
  capabilities: string[];
  /** Contextual primary CTA label (e.g. "Run Your Hostel"). */
  cta: string;
  stats: { value: string; label: string }[];
  challenges: { title: string; body: string }[];
  moduleIds: string[];
  testimonial: { quote: string; name: string; role: string };
}

export const SOLUTIONS: Solution[] = [
  {
    slug: "hotels",
    name: "Hotels",
    tagline: "Front desk to finance — every department on one PMS.",
    headline: "Run every department of your hotel in one platform",
    intro:
      "From check-in to night audit, HospiOS keeps front desk, housekeeping, restaurant, and accounting moving together in real time — no spreadsheets, no duplicate entry.",
    icon: "building",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
    imageAlt:
      "Premium hotel lobby with warm lighting and a check-in desk",
    accent: "indigo",
    audience: "City and business hotels with several departments",
    value: "Keep front desk, housekeeping, reservations and finance connected in real time.",
    capabilities: [
      "Front desk & room board",
      "Reservations & OTA sync",
      "Housekeeping handoffs",
      "Finance & night audit",
    ],
    cta: "Explore Hotel PMS",
    stats: [
      { value: "All-in-one", label: "departments on one system" },
      { value: "14+", label: "OTAs synced in real time" },
      { value: "Live", label: "inventory everywhere" },
    ],
    challenges: [
      {
        title: "Fragmented tools",
        body: "Front desk, housekeeping and billing live in different systems, forcing teams to re-key every stay.",
      },
      {
        title: "Overbooking & rate drift",
        body: "Inventory and rates slip across OTAs, causing overbookings, rate-parity issues and lost revenue.",
      },
      {
        title: "Guests want self-service",
        body: "Modern guests expect digital check-in, mobile requests, and instant confirmations.",
      },
    ],
    moduleIds: ["frontdesk", "reservations", "rooms", "housekeeping", "pos", "finance", "channel", "ai"],
    testimonial: {
      quote:
        "Front desk, housekeeping, POS and finance used to live in four different tools. HospiOS puts everything in one place — my team stopped re-keying data the week we switched.",
      name: "Illustrative example",
      role: "General Manager · 48-key boutique hotel",
    },
  },
  {
    slug: "groups",
    name: "Hotel Groups",
    tagline: "One dashboard for every property, brand, and team.",
    headline: "Consolidated control across your whole portfolio",
    intro:
      "HospiOS gives multi-property groups a central command center — shared users, consolidated reporting, central CRM and inventory — with property-specific pricing and branding across brands, countries and currencies.",
    icon: "network",
    image:
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "City skyline skyline at dusk, a hotel portfolio",
    accent: "sky",
    audience: "Multi-property groups and branded portfolios",
    value: "One dashboard for every property, brand and team — consolidated control across the whole group.",
    capabilities: [
      "Central visibility & switching",
      "Consolidated reporting",
      "Shared users & central CRM",
      "Multi-currency finance",
    ],
    cta: "Manage Your Portfolio",
    stats: [
      { value: "Central", label: "visibility across the group" },
      { value: "Any size", label: "property portfolio" },
      { value: "Consolidated", label: "night audit & reporting" },
    ],
    challenges: [
      {
        title: "No single source of truth",
        body: "Each property runs its own tool, so leadership can't compare performance or enforce standards.",
      },
      {
        title: "Duplicate administration",
        body: "Users, vendors, guest profiles and inventory get recreated for every site.",
      },
      {
        title: "Brand vs. local control",
        body: "Groups need central standards with the flexibility for property-specific rates and offers.",
      },
    ],
    moduleIds: ["multiproperty", "bi", "channel", "security", "hrms", "crm", "finance", "revenue"],
    testimonial: {
      quote:
        "We run a multi-property portfolio across countries. HospiOS cut the time we spend on operations and reporting from hours a week to about fifteen minutes.",
      name: "Illustrative example",
      role: "COO · multi-property group",
    },
  },
  {
    slug: "hostels",
    name: "Hostels",
    tagline: "Beds, dorms, and group bookings without the chaos.",
    headline: "Hostel management built for beds, not just rooms",
    intro:
      "Sell beds or entire dorms, handle group and seasonal bookings, and keep common-area revenue in one lightweight system built for high-volume, low-margin operations.",
    icon: "users",
    image:
      "https://images.unsplash.com/photo-1520869562399-e772f042f422?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Bright, social hostel common area with young travellers",
    accent: "blue",
    audience: "High-volume, budget and community-led hostels",
    value: "Manage beds, dorms, private rooms and group stays without switching systems.",
    capabilities: [
      "Bed-level inventory",
      "Fast group check-in",
      "Common-area POS",
      "24/7 self-service",
    ],
    cta: "Run Your Hostel",
    stats: [
      { value: "Fast", label: "group check-in" },
      { value: "Bed-level", label: "inventory & availability" },
      { value: "24/7", label: "guest self-service" },
    ],
    challenges: [
      {
        title: "Bed-level inventory",
        body: "Hostels sell beds and dorms, not just rooms — generic hotel tools get this wrong.",
      },
      {
        title: "High-volume front desk",
        body: "Fast check-ins, group arrivals and payments need to happen in seconds, not screens.",
      },
      {
        title: "Community & upsells",
        body: "Tours, lockers, laundry and bar revenue need one POS alongside the beds.",
      },
    ],
    moduleIds: ["frontdesk", "reservations", "rooms", "pos", "housekeeping", "crm", "marketing", "selfservice"],
    testimonial: {
      quote:
        "We handle a busy bed inventory and a constant stream of group bookings. HospiOS keeps beds, payments and housekeeping in sync without adding staff.",
      name: "Illustrative example",
      role: "Operations Manager · large hostel",
    },
  },
  {
    slug: "vacation-rentals",
    name: "Vacation Rentals",
    tagline: "Villas, cabins & holiday homes managed anywhere.",
    headline: "Short-let power without a front desk",
    intro:
      "Manage villas, cabins and holiday homes with digital check-in, automated messaging, smart pricing, and clean owner reporting — all from your phone.",
    icon: "key",
    image:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Modern vacation rental villa with a pool at dusk",
    accent: "orange",
    audience: "Villas, cabins and holiday-home owners",
    value: "Short-let power without a front desk — check-in, messaging and pricing from your phone.",
    capabilities: [
      "Digital check-in",
      "Automated guest messaging",
      "Smart pricing",
      "Clean owner reporting",
    ],
    cta: "Manage Your Rentals",
    stats: [
      { value: "Fewer", label: "owner calls & emails" },
      { value: "Digital", label: "check-in on arrival" },
      { value: "24/7", label: "automated guest messaging" },
    ],
    challenges: [
      {
        title: "Remote, distributed sites",
        body: "Properties across locations need one remote control — cleaning, pricing, and guest comms.",
      },
      {
        title: "Owner reporting",
        body: "Owners want clean, timely statements of bookings, income and expenses.",
      },
      {
        title: "Guest communication",
        body: "Check-in codes, welcome messages and house rules need to be automated.",
      },
    ],
    moduleIds: ["selfservice", "comms", "bookingengine", "channel", "revenue", "housekeeping", "maintenance", "finance"],
    testimonial: {
      quote:
        "We run a set of villas with a tiny team. Digital check-in and automated guest messages let us deliver five-star service without adding headcount.",
      name: "Illustrative example",
      role: "Owner · three villas",
    },
  },
  {
    slug: "boutique-hotels",
    name: "Boutique Hotels",
    tagline: "Personal service, design-led stays, zero admin noise.",
    headline: "The character of boutique, the power of enterprise",
    intro:
      "Small hotel, big standards. Boutique properties get the same front desk, housekeeping, POS and revenue tools as the large chains — tuned to a lean, service-obsessed team.",
    icon: "sparkle",
    image:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Design-led boutique hotel room with statement fixtures",
    accent: "magenta",
    audience: "Small, design-led and service-obsessed hotels",
    value: "The character of boutique with the power of enterprise — big-chain tools for a lean team.",
    capabilities: [
      "Personal guest profiles",
      "Direct booking engine",
      "Packages & upsell",
      "Revenue & POS",
    ],
    cta: "Run Your Boutique Property",
    stats: [
      { value: "Less", label: "time at the desk" },
      { value: "Upsell-ready", label: "packages & offers" },
      { value: "Guest-first", label: "personal service" },
    ],
    challenges: [
      {
        title: "Small team, big job",
        body: "A handful of staff still needs to run reception, rooms, restaurant and revenue.",
      },
      {
        title: "Personal touch at scale",
        body: "Guests choose boutique for character — you need guest profiles that remember every preference.",
      },
      {
        title: "Direct bookings",
        body: "Fewer OTAs, more direct stays, with a branded booking engine that shows your personality.",
      },
    ],
    moduleIds: ["frontdesk", "reservations", "rooms", "crm", "bookingengine", "pos", "marketing", "revenue"],
    testimonial: {
      quote:
        "We're a small design hotel. HospiOS gives us the polish of a big chain PMS without a big-chain team — check-in is genuinely personal again.",
      name: "Illustrative example",
      role: "Owner · small design hotel",
    },
  },
  {
    slug: "resorts",
    name: "Resorts",
    tagline: "Rooms, villas, dining & activities on one platform.",
    headline: "Every amenity, every guest, orchestrated",
    intro:
      "Resorts juggle rooms and villas, multiple restaurants, spas, pools, activities and group events. HospiOS keeps all of it — and every folio — moving together in real time.",
    icon: "building",
    image:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Tropical resort pool and loungers in warm light",
    accent: "teal",
    audience: "Resorts juggling rooms, villas, dining and activities",
    value: "Coordinate rooms, dining, activities and guest experiences from one platform.",
    capabilities: [
      "Multi-outlet folio billing",
      "Group & events blocks",
      "Restaurant & F&B POS",
      "One-pass night audit",
    ],
    cta: "Explore Resort Operations",
    stats: [
      { value: "Single", label: "folio for every outlet" },
      { value: "One pass", label: "night audit & settlement" },
      { value: "24/7", label: "uptime in season" },
    ],
    challenges: [
      {
        title: "Multi-outlet billing",
        body: "Restaurants, spa, activities and room charges all need to land on the right folio instantly.",
      },
      {
        title: "Group & events",
        body: "Weddings, conferences and tour groups need block inventory and consolidated billing.",
      },
      {
        title: "Seasonal staffing",
        body: "Ramps of housekeeping and F&B staff need scheduling that adapts to occupancy.",
      },
    ],
    moduleIds: ["frontdesk", "rooms", "pos", "finance", "multiproperty", "hrms", "marketing", "maintenance"],
    testimonial: {
      quote:
        "Multiple restaurants, a large room inventory and a busy events calendar — night audit used to take two hours across five screens. Now it's one pass.",
      name: "Illustrative example",
      role: "Resort Director · full-service resort",
    },
  },
  {
    slug: "bed-and-breakfast",
    name: "Bed & Breakfasts",
    tagline: "A handful of rooms, managed like it's effortless.",
    headline: "Simple enough to run over breakfast",
    intro:
      "The easiest way to manage a few rooms well. HospiOS handles bookings, housekeeping, guest messages and the online presence score — so you can stay guest-facing.",
    icon: "guest",
    image:
      "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Intimate, warm guest bedroom in a small bed and breakfast",
    accent: "amber",
    audience: "Owner-operators with a handful of rooms",
    value: "Simple enough to run over breakfast — bookings, housekeeping and messages handled for you.",
    capabilities: [
      "Effortless booking engine",
      "Automated guest messages",
      "Housekeeping on a small team",
      "Free presence score",
    ],
    cta: "Simplify Your B&B",
    stats: [
      { value: "Fast", label: "setup to go live" },
      { value: "24/7", label: "automated guest messages" },
      { value: "Zero", label: "spreadsheets needed" },
    ],
    challenges: [
      {
        title: "Time is the budget",
        body: "Owner-operators can't afford a system that takes hours to learn or maintain.",
      },
      {
        title: "Bookings from everywhere",
        body: "Airbnb, Booking.com and direct — all landing in different inboxes and calendars.",
      },
      {
        title: "Review reputation",
        body: "A handful of reviews can make or break a B&B — you need the free score and AI reply drafts.",
      },
    ],
    moduleIds: ["bookingengine", "frontdesk", "housekeeping", "comms", "channel", "selfservice", "marketing", "revenue"],
    testimonial: {
      quote:
        "I run a handful of rooms at home. HospiOS turned 'hotel software' into something I actually enjoy using at the kitchen table.",
      name: "Illustrative example",
      role: "Owner · small B&B",
    },
  },
  {
    slug: "serviced-apartments",
    name: "Serviced Apartments",
    tagline: "Corporate stays, extended stays, zero front desk.",
    headline: "Long-stay comfort, short-stay efficiency",
    intro:
      "Serviced apartments blend hotel service with apartment flexibility. Automate extended-stay pricing, monthly invoicing and housekeeping — and let guests check in from their phone.",
    icon: "key",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Bright modern serviced apartment living space",
    accent: "emerald",
    audience: "Corporate and long-stay apartment operators",
    value: "Long-stay comfort, short-stay efficiency — automate extended stays without a front desk.",
    capabilities: [
      "Digital check-in",
      "Long-stay rate plans",
      "Monthly invoicing",
      "Self-service access",
    ],
    cta: "Manage Extended Stays",
    stats: [
      { value: "Faster", label: "guest check-in" },
      { value: "Long-stay", label: "rate plans & invoicing" },
      { value: "24/7", label: "self-service access" },
    ],
    challenges: [
      {
        title: "Mixed stay lengths",
        body: "One-night corporate stays and 60-day relocations need different rates, invoicing and cleaning cycles.",
      },
      {
        title: "Corporate billing",
        body: "Companies need clean monthly statements, tax invoices and approver workflows.",
      },
      {
        title: "Distributed blocks",
        body: "Apartments scattered across buildings need status tracking without a central desk.",
      },
    ],
    moduleIds: ["reservations", "selfservice", "finance", "comms", "housekeeping", "maintenance", "channel", "revenue"],
    testimonial: {
      quote:
        "Corporate guests expect instant check-in and clean monthly invoices. HospiOS delivers both — our occupancy tracking finally matches reality.",
      name: "Illustrative example",
      role: "Operations Lead · serviced apartments",
    },
  },
  {
    slug: "hourly-flexible-stays",
    name: "Hourly & Flexible Stays",
    tagline: "Short-stay rules that actually make sense.",
    headline: "Sell the hours, not just the nights",
    intro:
      "Day-use, transit and flexible stays are a growing revenue line. HospiOS supports hourly rate plans, block-based availability and smart overbooking protection across your channels.",
    icon: "calendar",
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Modern hotel room ready for a short-stay turnaround",
    accent: "sky",
    audience: "Properties selling day-use and flexible stays",
    value: "Sell the hours, not just the nights — slot-based inventory for hourly revenue.",
    capabilities: [
      "Hourly rate plans",
      "Slot-based availability",
      "Per-channel rules",
      "Quick-turn housekeeping",
    ],
    cta: "Explore Flexible Stays",
    stats: [
      { value: "New", label: "day-use revenue line" },
      { value: "Hourly", label: "blocks & arrival windows" },
      { value: "Safe", label: "slot-based inventory" },
    ],
    challenges: [
      {
        title: "Hourly vs nightly inventory",
        body: "The same room can be sold by the hour and by the night — that needs slot-based inventory, not a simple calendar.",
      },
      {
        title: "Channel rules",
        body: "Some OTAs support day-use, others don't. Distribution needs per-channel stops and minimums.",
      },
      {
        title: "Housekeeping between slots",
        body: "Quick-turn cleans between day-use blocks need instant task creation and clear priorities.",
      },
    ],
    moduleIds: ["reservations", "rooms", "channel", "housekeeping", "revenue", "frontdesk", "selfservice", "comms"],
    testimonial: {
      quote:
        "Day-use rooms used to mean phone calls and missed revenue. Now hour slots sell on our site and on channels with zero overbooking.",
      name: "Illustrative example",
      role: "Owner · city hotel",
    },
  },
  {
    slug: "experimental-stays",
    name: "Experimental Stays",
    tagline: "Glamping, tiny houses & pop-up concepts.",
    headline: "New formats deserve modern software",
    intro:
      "Glamping pods, tiny houses, floating rooms and pop-up stays are redefining hospitality. HospiOS's flexible room types and configurable rates handle formats traditional PMS tools can't.",
    icon: "sparkle",
    image:
      "https://images.unsplash.com/photo-1521783988139-89397d761dce?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Glamping tent with a view, a flexible accommodation format",
    accent: "magenta",
    audience: "Glamping, tiny-house and pop-up stay operators",
    value: "New formats deserve modern software — flexible room types for concepts traditional PMS can't handle.",
    capabilities: [
      "Flexible room types",
      "Fast concept launch",
      "Remote guest self-service",
      "14+ OTA channels",
    ],
    cta: "Launch Your Concept",
    stats: [
      { value: "Flexible", label: "room & concept types" },
      { value: "Fast", label: "concept launch" },
      { value: "14+", label: "OTA channels" },
    ],
    challenges: [
      {
        title: "Non-standard inventory",
        body: "Pods, tents and cabins don't fit room-number thinking — inventory must be shape-shifting.",
      },
      {
        title: "Seasonal concepts",
        body: "Pop-up stays appear and disappear — you need to activate concepts without rebuilding your system.",
      },
      {
        title: "Guest self-sufficiency",
        body: "Remote sites need digital check-in, keyless access and automated communication from day one.",
      },
    ],
    moduleIds: ["rooms", "reservations", "bookingengine", "selfservice", "comms", "revenue", "housekeeping", "marketing"],
    testimonial: {
      quote:
        "We launch a new glamping concept every season. HospiOS lets us spin up inventory, pricing and a booking page in an afternoon.",
      name: "Illustrative example",
      role: "Founder · seasonal stays",
    },
  },
];

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}

/**
 * The 8 core property types featured on the homepage showcase. A curated subset
 * of SOLUTIONS (single source); expand via SOLUTIONS, not here, so taxonomy
 * never diverges.
 */
export const SHOWCASE_SOLUTIONS: string[] = [
  "hotels",
  "groups",
  "hostels",
  "vacation-rentals",
  "boutique-hotels",
  "resorts",
  "bed-and-breakfast",
  "serviced-apartments",
];

export function getShowcaseSolutions(): Solution[] {
  return SHOWCASE_SOLUTIONS.map((slug) => getSolution(slug)!).filter(Boolean);
}