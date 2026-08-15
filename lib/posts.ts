/**
 * Blog content for the /blog hub and /blog/[slug] pages.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  body: { heading?: string; text?: string; list?: string[] }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "choose-a-hotel-pms",
    title: "How to choose a hotel PMS (and what to check before you sign)",
    excerpt:
      "The practical checklist every hotel owner should use before picking a property management system.",
    date: "2026-07-28",
    readTime: "6 min read",
    category: "Hotel Management",
    body: [
      {
        text: "Your PMS touches every guest, every booking, and every rupee that moves through your property. Choosing badly means years of re-keying data and paying for integrations you don't need. Choosing well means your front desk, housekeeping, kitchen and finance finally stop living in separate tools.",
      },
      { heading: "What to check before you sign", list: [
        "Is it cloud-native with a mobile app, or does it need an on-site server?",
        "Does the channel manager really sync two-way, in real time?",
        "Can housekeeping, front desk and POS talk to each other without plugins?",
        "Is pricing per-room and transparent, or buried in add-ons?",
        "Who owns your guest data, and can you export it any time?",
      ]},
      { heading: "The all-in-one advantage", text: "Modern platforms like HospiOS combine PMS, channel manager, booking engine, POS, inventory, finance and AI in a single system. That's not just fewer logins — it's one source of truth, no duplicate entry, and reports that actually reconcile." },
      { heading: "Try before you commit", text: "Look for a free plan or trial that includes your real channels and a real walkthrough. Your decision should be based on your property, live, not on a demo deck." },
    ],
  },
  {
    slug: "why-direct-bookings-matter",
    title: "Why direct bookings matter more than ever",
    excerpt:
      "OTA commission is eating your margin. Here's how a booking engine wins guests back to your own website.",
    date: "2026-07-15",
    readTime: "5 min read",
    category: "Revenue",
    body: [
      {
        text: "Every booking you take through an OTA costs 12–20% of the room rate. Direct bookings aren't just cheaper — they hand you the guest relationship, the data, and the chance to upsell.",
      },
      { heading: "How to grow direct demand", list: [
        "Offer a best-price guarantee with an extra perk for booking direct",
        "Make your booking engine fast and mobile-first — every second costs conversions",
        "Capture guest emails and follow up with automated review requests",
        "Run packages and promo codes OTAs can't match",
      ]},
      { heading: "Same inventory, every channel", text: "A modern booking engine shares the exact same availability as your channel manager, so you never overbook — and direct bookings close OTA inventory instantly." },
      { heading: "The bottom line", text: "Growing direct share by even 10 points typically adds 2–3% to net revenue for a mid-size hotel. The booking engine pays for itself in the first month." },
    ],
  },
  {
    slug: "housekeeping-faster-checkins",
    title: "Cut housekeeping turnaround time in half",
    excerpt:
      "How auto-generated cleaning tasks and a live readiness board speed up every checkout-to-check-in.",
    date: "2026-06-30",
    readTime: "4 min read",
    category: "Operations",
    body: [
      {
        text: "The gap between a guest checking out and the next guest walking in is where money is lost. Slow handoffs between front desk and housekeeping mean rooms sit empty — or worse, guests walk into an uncleaned room.",
      },
      { heading: "What makes turnaround slow", list: [
        "Housekeeping doesn't know a room is free until someone calls them",
        "No standard checklist means inconsistent cleaning",
        "Supervisors can't approve rooms without walking the floor",
      ]},
      { heading: "The fix: let the system do the handoff", text: "When a guest checks out, HospiOS instantly creates a housekeeping task. The supervisor approves the clean room on their phone, and it's bookable again in real time — no calls, no whiteboards, no waiting." },
      { heading: "The result", text: "Properties typically cut turnaround time in half and add back 1–2 sellable nights per room per month." },
    ],
  },
  {
    slug: "ai-pricing-not-just-buzzword",
    title: "AI dynamic pricing: more than a buzzword",
    excerpt:
      "What occupancy-aware pricing actually does for your ADR and why simulation matters.",
    date: "2026-06-12",
    readTime: "5 min read",
    category: "Revenue",
    body: [
      {
        text: "Pricing is the fastest lever on hotel profit. Yet most properties set rates once a season and hope. AI dynamic pricing moves with demand — without giving up your judgment.",
      },
      { heading: "How it works", list: [
        "Occupancy and pace of bookings drive daily rate suggestions per room type",
        "Weekend, festival and length-of-stay rules are applied automatically",
        "Competitor rates inform parity and positioning",
      ]},
      { heading: "Simulate before you commit", text: "The safest way to adopt AI pricing is to simulate first. Run a weekend-markup scenario against projected ADR and occupancy, see the revenue impact, and only then publish." },
      { heading: "The result", text: "Properties using AI-driven rates typically see ADR gains of 5–15% without sacrificing occupancy." },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
