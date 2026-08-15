/**
 * Knowledge-base articles for the /knowledge-base hub and detail pages.
 */

export interface KnowledgeArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  updated: string;
  readTime: string;
  body: { heading?: string; text?: string; list?: string[] }[];
}

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: "getting-started-guide",
    title: "Getting started with HospiOS",
    excerpt:
      "From sign-up to your first booking: the 30-minute setup checklist every new property follows.",
    category: "Getting Started",
    updated: "2026-07-22",
    readTime: "6 min read",
    body: [
      {
        text: "Most properties go live within a day. This guide walks the exact steps from sign-up to your first confirmed booking.",
      },
      { heading: "Step 1 — Property setup", list: [
        "Add your property, room types and rate plans",
        "Upload room photos and amenities",
        "Configure check-in / check-out times",
      ]},
      { heading: "Step 2 — Channels", text: "Connect your OTAs through the channel manager. Map each room and rate plan once; HospiOS keeps everything in sync from there." },
      { heading: "Step 3 — Go live", text: "Make your booking engine visible, then place your first test booking to verify confirmation emails, housekeeping tasks and the folio flow." },
    ],
  },
  {
    slug: "connect-booking-com",
    title: "Connecting Booking.com to HospiOS",
    excerpt:
      "Two-way inventory and rate sync with Booking.com in five steps — plus mapping tips.",
    category: "Channels",
    updated: "2026-07-15",
    readTime: "4 min read",
    body: [
      {
        text: "Booking.com is usually the first channel properties connect. The channel manager handles the handshake; you handle the mapping.",
      },
      { heading: "Steps", list: [
        "Open Channels → Connect → Booking.com",
        "Sign in with your extranet credentials",
        "Map your room types to Booking.com room types",
        "Map rate plans and restrictions",
        "Activate and verify one test reservation",
      ]},
      { heading: "Mapping tips", text: "Keep room-type names identical across channels where possible, and match rate plans one-to-one. This avoids the silent mismatches that cause overbooking." },
    ],
  },
  {
    slug: "night-audit-explained",
    title: "Night audit explained (and how to pass it fast)",
    excerpt:
      "What night audit actually does, why it must balance, and how HospiOS automates the boring 90%.",
    category: "Finance",
    updated: "2026-06-28",
    readTime: "5 min read",
    body: [
      {
        text: "Night audit is the daily close that makes sure today's revenue lands in the right place — folios, taxes and house accounts all reconciled.",
      },
      { heading: "What it covers", list: [
        "Posting room charges and taxes for in-house guests",
        "Reconciling outlets, payments and advances",
        "Rolling the date forward and opening the new day",
      ]},
      { heading: "The automated 90%", text: "HospiOS posts charges, reconciles payments and generates reports automatically. You review exceptions, click approve, and the audit log records everything." },
    ],
  },
  {
    slug: "create-rate-plans",
    title: "Creating rate plans that protect your ADR",
    excerpt:
      "Bar rates, weekend and length-of-stay plans — set up pricing that works across all channels.",
    category: "Revenue",
    updated: "2026-06-10",
    readTime: "5 min read",
    body: [
      {
        text: "Rate plans are the skeleton of your pricing. Get them right once and every channel, package and promo inherits the logic.",
      },
      { heading: "Best practices", list: [
        "Start with a clean bar rate per room type",
        "Add weekend and length-of-stay multipliers",
        "Keep OTA rates at parity to protect direct demand",
        "Use packages for value, not discounting the bar rate",
      ]},
      { heading: "AI assist", text: "Turn on dynamic pricing in simulation mode first: preview suggested rates against projected occupancy and only publish when you're comfortable." },
    ],
  },
  {
    slug: "invoice-corporate-guests",
    title: "Invoicing corporate and long-stay guests",
    excerpt:
      "Monthly statements, tax invoices and approval workflows for business travelers.",
    category: "Finance",
    updated: "2026-05-19",
    readTime: "4 min read",
    body: [
      {
        text: "Corporate guests expect clean monthly invoices, not a pile of paper receipts. HospiOS groups stays, taxes and charges into statements you can send with one click.",
      },
      { heading: "Workflow", list: [
        "Tag the guest profile as corporate with billing address and PO",
        "Auto-consolidate folios at month end",
        "Send the invoice with tax breakdown and payment link",
        "Track paid / unpaid status from the guest timeline",
      ]},
    ],
  },
  {
    slug: "housekeeping-status-guide",
    title: "Housekeeping statuses: the front desk cheat sheet",
    excerpt:
      "Dirty, clean, inspected, out-of-order — what each status means and how they drive your room board.",
    category: "Housekeeping",
    updated: "2026-04-30",
    readTime: "4 min read",
    body: [
      {
        text: "A clean, honest room board is the fastest thing you can improve at your property. Statuses are the language it speaks.",
      },
      { heading: "The statuses", list: [
        "Dirty — guest out, room not yet cleaned",
        "Clean — cleaned, awaiting supervisor approval",
        "Inspected — approved and sellable in real time",
        "Out of order — maintenance, not sellable",
      ]},
      { heading: "Why it matters", text: "When housekeeping updates status on their phone, the front desk and every channel instantly know the room is sellable. That's how you stop turning away early arrivals with a clean room sitting in limbo." },
    ],
  },
];

export function getArticle(slug: string): KnowledgeArticle | undefined {
  return KNOWLEDGE_ARTICLES.find((a) => a.slug === slug);
}
