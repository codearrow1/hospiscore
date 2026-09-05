/**
 * Case-study content for the /case-studies hub and /case-studies/[slug] pages.
 * These are illustrative scenarios based on common operator journeys —
 * not claims about named real deployments.
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
    slug: "coastal-boutique-direct-revenue",
    company: "Coastal Boutique Inn",
    headline: "Winning back direct bookings, one evening at a time",
    summary:
      "A small coastal inn replaces a legacy PMS and channel manager with HospiOS to stop re-keying and grow direct bookings.",
    sector: "Boutique Hotels",
    location: "Example · coastal town",
    size: "40 rooms",
    date: "2026-07-02",
    challenge:
      "The front desk was re-keying bookings from several systems into a fourth, and night audit dragged across multiple screens. Team evenings disappeared into admin.",
    approach:
      "HospiOS unified the booking engine, channel manager, front desk and finance in a single system — a branded booking engine with a best-rate promise, two-way OTA sync, and automated review requests after checkout.",
    results: [
      { metric: "Direct revenue", value: "Climbing", label: "quarter over quarter" },
      { metric: "Night audit", value: "One pass", label: "across all outlets" },
      { metric: "Re-keying", value: "Zero", label: "between systems" },
    ],
    quote: {
      text: "The first week we stopped re-keying bookings we got our evenings back. By month two, direct bookings were clearly climbing — we could see it in the dashboard, not guess it.",
      name: "Illustrative example",
      role: "Owner · coastal boutique inn",
    },
    tags: ["Direct bookings", "Channel manager", "Night audit"],
  },
  {
    slug: "resort-group-one-platform",
    company: "Six-Property Resort Group",
    headline: "Every property, one dashboard",
    summary:
      "A family-run resort group consolidates six properties onto HospiOS and sees the whole portfolio in one view.",
    sector: "Resorts",
    location: "Example · resort group",
    size: "6 properties · 210 rooms",
    date: "2026-06-18",
    challenge:
      "Each property ran a different spreadsheet-and-PMS hybrid. Owners compared performance once a month and corporate bookings were manually reconciled.",
    approach:
      "The group adopted HospiOS Enterprise for centralized reporting, shared guest profiles and a single corporate billing workflow, while keeping per-property pricing and branding.",
    results: [
      { metric: "Reporting", value: "Minutes", label: "instead of days" },
      { metric: "Owners' view", value: "One", label: "live dashboard" },
      { metric: "Systems", value: "One", label: "platform to maintain" },
    ],
    quote: {
      text: "For the first time the owners see every property on one dashboard. Decisions that used to wait for a monthly meeting now happen on Monday morning.",
      name: "Illustrative example",
      role: "Group GM · six-property resort group",
    },
    tags: ["Multi-property", "Consolidated reporting", "Corporate billing"],
  },
  {
    slug: "seasonal-glamping-flexible-inventory",
    company: "Seasonal Glamping Operator",
    headline: "A new glamping concept in one afternoon",
    summary:
      "An experimental-stays operator uses HospiOS flexible inventory to launch seasonal concepts without rebuilding its system.",
    sector: "Experimental Stays",
    location: "Example · Nordics",
    size: "24 pods · seasonal",
    date: "2026-05-27",
    challenge:
      "Glamping pods don't fit room-number thinking. The team was stitching together calendars, spreadsheets and an OTA account per concept.",
    approach:
      "HospiOS flexible room types let them activate a new pod concept with inventory, pricing and a branded booking page in an afternoon. Digital check-in and automated guest messages run the remote sites.",
    results: [
      { metric: "Launch time", value: "Afternoon", label: "new concept live" },
      { metric: "Upsell revenue", value: "Higher", label: "add-ons per stay" },
      { metric: "Guest support", value: "Fewer", label: "inbound messages" },
    ],
    quote: {
      text: "We treated every season as a rebuild. Now a concept is a few clicks — inventory, rates, a landing page, done.",
      name: "Illustrative example",
      role: "Founder · seasonal glamping operator",
    },
    tags: ["Flexible inventory", "Digital check-in", "Automation"],
  },
  {
    slug: "serviced-apartments-self-service",
    company: "Serviced Apartment Operator",
    headline: "Serviced apartments without a front desk",
    summary:
      "A 60-unit serviced-apartment operator moves guest arrival online and automates long-stay invoicing.",
    sector: "Serviced Apartments",
    location: "Example · Scandinavia",
    size: "60 apartments",
    date: "2026-04-15",
    challenge:
      "Guests arriving after reception hours waited in lobbies. Staff manually keyed guest details, and long-stay invoices were assembled by hand.",
    approach:
      "HospiOS self-service portal delivered digital check-in, key codes and automated welcome flows. Long-stay rate plans and monthly corporate invoicing automated the billing backlog.",
    results: [
      { metric: "Check-in", value: "Minutes", label: "from arrival to room" },
      { metric: "Reception load", value: "Lower", label: "after-hours work" },
      { metric: "Invoicing", value: "Auto", label: "monthly statements" },
    ],
    quote: {
      text: "Guests now arrive to a room ready and a code on their phone. We don't need a desk to run a great apartment.",
      name: "Illustrative example",
      role: "Operations Lead · serviced apartment operator",
    },
    tags: ["Self-service", "Long stays", "Corporate billing"],
  },
  {
    slug: "design-hotel-ai-review-replies",
    company: "Design-Focused City Hotel",
    headline: "Every review, answered the same day",
    summary:
      "A small design hotel clears a review backlog with AI reply drafts that staff always approve before sending.",
    sector: "Boutique Hotels",
    location: "Example · London, UK",
    size: "14 rooms",
    date: "2026-03-08",
    challenge:
      "Reviews went days without a reply, dragging the property's response rate and its visibility on review platforms.",
    approach:
      "The team turned on AI reply drafts with human approval. Every new review got a personalized, on-brand draft in seconds — staff reviewed and hit send from one inbox.",
    results: [
      { metric: "Response rate", value: "High", label: "same-day replies" },
      { metric: "Score", value: "Improved", label: "online presence score" },
      { metric: "Review time", value: "Seconds", label: "per reply" },
    ],
    quote: {
      text: "Guests noticed. Our response rate is now a selling point and the scoreboard finally reflects how much care goes into this hotel.",
      name: "Illustrative example",
      role: "Owner · small design hotel",
    },
    tags: ["AI", "Review management", "Online presence"],
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}