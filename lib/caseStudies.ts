/**
 * Case-study content for the /case-studies hub and /case-studies/[slug] pages.
 */

export interface CaseStudy {
  slug: string;
  company: string;
  headline: string;
  summary: string;
  sector: string;
  location: string;
  size: string;
  date: string;
  challenge: string;
  approach: string;
  results: { metric: string; value: string; label: string }[];
  quote: { text: string; name: string; role: string };
  tags: string[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "harbor-lights-direct-revenue",
    company: "Harbor Lights Inn",
    headline: "+38% direct revenue in one quarter",
    summary:
      "A 40-room coastal inn replaced its legacy PMS and channel manager with HospiOS to win back direct bookings and cut night-audit time.",
    sector: "Boutique Hotels",
    location: "Coastal, US",
    size: "40 rooms",
    date: "2026-07-02",
    challenge:
      "OTA commission was eating 18% of revenue and the front desk was re-keying bookings from three systems into a fourth. Night audit took two hours across five screens.",
    approach:
      "HospiOS unified the booking engine, channel manager, front desk and finance in a single system. The team activated the branded booking engine with a best-rate promise, connected two-way OTA sync, and automated review requests after checkout.",
    results: [
      { metric: "Direct revenue", value: "+38%", label: "in one quarter" },
      { metric: "Night audit", value: "2h → 15m", label: "across all outlets" },
      { metric: "Commission", value: "-14 pts", label: "of revenue saved" },
    ],
    quote: {
      text: "The first week we stopped re-keying bookings we got our evenings back. By month two, direct bookings were clearly climbing — we could see it in the dashboard, not guess it.",
      name: "Marta Alvarez",
      role: "Owner · Harbor Lights Inn",
    },
    tags: ["Direct bookings", "Channel manager", "Night audit"],
  },
  {
    slug: "casa-verde-multiproperty",
    company: "Casa Verde Resorts",
    headline: "Six properties, one night audit",
    summary:
      "A family-run resort group consolidated six properties onto HospiOS and cut reporting from three days a month to minutes.",
    sector: "Resorts",
    location: "Central America",
    size: "6 properties · 210 rooms",
    date: "2026-06-18",
    challenge:
      "Each property ran a different spreadsheet-and-PMS hybrid. Owners compared performance once a month and corporate bookings were manually reconciled.",
    approach:
      "The group adopted HospiOS Enterprise for centralized reporting, shared guest profiles and a single corporate billing workflow, while keeping per-property pricing and branding.",
    results: [
      { metric: "Reporting", value: "3 days → 10 min", label: "monthly close" },
      { metric: "Occupancy", value: "+11%", label: "group-wide YOY" },
      { metric: "Systems", value: "12 → 1", label: "tools to maintain" },
    ],
    quote: {
      text: "For the first time the owners see every property on one dashboard. Decisions that used to wait for a monthly meeting now happen on Monday morning.",
      name: "Lucia Mendoza",
      role: "Group GM · Casa Verde Resorts",
    },
    tags: ["Multi-property", "Consolidated reporting", "Corporate billing"],
  },
  {
    slug: "north-pod-flexible-stays",
    company: "North Pod Collective",
    headline: "Glamping concepts live in one afternoon",
    summary:
      "An experimental-stays startup uses HospiOS flexible inventory to launch seasonal glamping concepts without rebuilding its system.",
    sector: "Experimental Stays",
    location: "Nordics",
    size: "24 pods · seasonal",
    date: "2026-05-27",
    challenge:
      "Glamping pods don't fit room-number thinking. The team was stitching together calendars, spreadsheets and an OTA account per concept.",
    approach:
      "HospiOS flexible room types let them activate a new pod concept with inventory, pricing and a branded booking page in an afternoon. Digital check-in and automated guest messages run the remote sites.",
    results: [
      { metric: "Launch time", value: "weeks → 1 day", label: "new concept live" },
      { metric: "Upsell revenue", value: "+22%", label: "add-ons per stay" },
      { metric: "Guest support", value: "-60%", label: "inbound messages" },
    ],
    quote: {
      text: "We treated every season as a rebuild. Now a concept is a few clicks — inventory, rates, a landing page, done.",
      name: "Freja Holm",
      role: "Founder · North Pod Collective",
    },
    tags: ["Flexible inventory", "Digital check-in", "Automation"],
  },
  {
    slug: "driftwood-selfservice",
    company: "Driftwood Apartments",
    headline: "Serviced apartments without a front desk",
    summary:
      "A 60-unit serviced-apartment operator removed reception hours and cut check-in time to five minutes with guest self-service.",
    sector: "Serviced Apartments",
    location: "Scandinavia",
    size: "60 apartments",
    date: "2026-04-15",
    challenge:
      "Guests arriving after reception hours waited in lobbies. Staff manually keyed guest details, and long-stay invoices were assembled by hand.",
    approach:
      "HospiOS self-service portal delivered digital check-in, key codes and automated welcome flows. Long-stay rate plans and monthly corporate invoicing automated the billing backlog.",
    results: [
      { metric: "Check-in", value: "25m → 5m", label: "average time" },
      { metric: "Staff hours", value: "−40%", label: "at reception" },
      { metric: "Invoicing", value: "auto", label: "monthly statements" },
    ],
    quote: {
      text: "Guests now arrive to a room ready and a code on their phone. We don't need a desk to run a great apartment.",
      name: "Marcus Chen",
      role: "Operations Lead · Driftwood Apartments",
    },
    tags: ["Self-service", "Long stays", "Corporate billing"],
  },
  {
    slug: "gilded-fox-upsell",
    company: "Gilded Fox Boutique",
    headline: "AI reply drafts that doubled review response",
    summary:
      "A 14-room boutique hotel automated review replies with AI drafts and turned a review backlog into a competitive advantage.",
    sector: "Boutique Hotels",
    location: "London, UK",
    size: "14 rooms",
    date: "2026-03-08",
    challenge:
      "Reviews went days without a reply, dragging the property's average response rate and its search visibility on review platforms.",
    approach:
      "The team turned on AI reply drafts with human approval. Every new review got a personalized, on-brand draft in seconds — staff reviewed and hit send from one inbox.",
    results: [
      { metric: "Response rate", value: "31% → 98%", label: "within 24h" },
      { metric: "Score", value: "+1.2★", label: "online presence score" },
      { metric: "Review time", value: "2m → 20s", label: "per reply" },
    ],
    quote: {
      text: "Guests noticed. Our response rate is now a selling point and the scoreboard finally reflects how much care goes into this hotel.",
      name: "Elena Rossi",
      role: "Owner · Gilded Fox Boutique",
    },
    tags: ["AI", "Review management", "Online presence"],
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
