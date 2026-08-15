/**
 * Product updates / changelog for the /product-updates hub.
 */

export interface UpdateItem {
  slug: string;
  version: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  body: { heading?: string; text?: string; list?: string[] }[];
}

export const UPDATES: UpdateItem[] = [
  {
    slug: "ai-night-audit-recommendations",
    version: "v4.6",
    title: "AI night-audit recommendations",
    excerpt:
      "Night audit now flags discrepancies before they compound — rate gaps, unpaid folios and double charges surfaced automatically.",
    date: "2026-08-01",
    tags: ["AI", "Finance"],
    body: [
      {
        text: "Night audit is where small errors become big ones. v4.6 introduces an AI review pass that checks every folio before you post the audit.",
      },
      { heading: "What it catches", list: [
        "Rate mismatches between reservation and posted room charge",
        "Unpaid or partially paid folios at check-out",
        "Duplicate charges across outlets",
        "Tax line inconsistencies",
      ]},
      { heading: "How it works", text: "One click runs the checks, opens a recommended-fix list, and posts the audit with a full log. You stay in control — nothing is auto-posted." },
    ],
  },
  {
    slug: "faster-migration-toolkit",
    version: "v4.5",
    title: "Self-serve migration toolkit",
    excerpt:
      "Import reservations, guests and rate plans from 40+ legacy PMSs — most properties go live in under a day.",
    date: "2026-07-10",
    tags: ["Migration", "Onboarding"],
    body: [
      {
        text: "Switching PMS was the #1 reason customers delayed switching at all. v4.5 removes the fear with a guided, self-serve import flow.",
      },
      { heading: "What you can import", list: [
        "Reservations, check-ins and stay history",
        "Guest profiles, preferences and documents",
        "Rate plans, promotions and OTA mapping",
        "Housekeeping and maintenance history",
      ]},
      { heading: "Going live", text: "After import, run a pilot property, reconcile one night audit, then switch the rest. Our onboarding team is on call for every step." },
    ],
  },
  {
    slug: "whatsapp-rich-media",
    version: "v4.4",
    title: "WhatsApp rich media & booking links",
    excerpt:
      "Send room photos, payment links and one-tap booking links inside WhatsApp conversations.",
    date: "2026-06-15",
    tags: ["Comms", "Guest"],
    body: [
      {
        text: "Guests live in WhatsApp. Now your guest messages can too — with rich media and payment links that close the loop in chat.",
      },
      { heading: "New in the Communication Center", list: [
        "Room photos and video walkthroughs in messages",
        "Secure payment links for deposits and balances",
        "One-tap booking links that prefill the guest's details",
        "Templates for check-in, house rules and review requests",
      ]},
    ],
  },
  {
    slug: "channel-overbooking-guard",
    version: "v4.3",
    title: "Channel overbooking guard",
    excerpt:
      "A safety buffer per channel and room type stops the double-booking spiral at peak demand.",
    date: "2026-05-20",
    tags: ["Channel Manager", "Revenue"],
    body: [
      {
        text: "Peak season exposes the weakest link in distribution. The overbooking guard adds configurable safety buffers so a spike on one OTA can't oversell your rooms.",
      },
      { heading: "How it works", list: [
        "Per-channel and per-room-type safety thresholds",
        "Real-time inventory caps before sync",
        "Alerting when a channel approaches its buffer",
        "Suggested buffer sizes from your booking pace",
      ]},
    ],
  },
  {
    slug: "mobile-housekeeping-app",
    version: "v4.2",
    title: "Redesigned mobile housekeeping app",
    excerpt:
      "Faster task lists, offline checklists and photo evidence for supervisors on the go.",
    date: "2026-04-25",
    tags: ["Housekeeping", "Mobile"],
    body: [
      {
        text: "Housekeeping runs on phones in hallways, not desktops at the office. v4.2 reworks the mobile app around one-handed, offline-first workflows.",
      },
      { heading: "What changed", list: [
        "Task list grouped by floor and priority, one tap to start",
        "Offline checklists that sync when signal returns",
        "Photo evidence for inspections and damage reports",
        "Instant room-ready push to the front desk",
      ]},
    ],
  },
];

export function getUpdate(slug: string): UpdateItem | undefined {
  return UPDATES.find((u) => u.slug === slug);
}
