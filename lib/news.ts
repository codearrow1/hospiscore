/**
 * Company news & announcements for the /news hub.
 */

export interface NewsItem {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  body: { heading?: string; text?: string; list?: string[] }[];
}

export const NEWS_ITEMS: NewsItem[] = [
  {
    slug: "hospios-raises-series-a",
    title: "HospiOS raises $8M Series A to double down on AI for hospitality",
    excerpt:
      "The funding accelerates our AI pricing, forecasting and automation roadmap — plus a self-serve migration toolkit.",
    date: "2026-07-20",
    category: "Company",
    body: [
      {
        text: "HospiOS today announced an $8M Series A led by Sequoia-style conviction: hospitality runs on margins, and AI finally makes those margins defendable for independent properties.",
      },
      { heading: "Where the money goes", list: [
        "AI pricing and revenue forecasting for every property size",
        "A self-serve data-migration toolkit to switch from any legacy PMS",
        "Deeper OTA integrations and a public partner marketplace",
      ]},
      { heading: "What it means for customers", text: "No price changes for existing plans. The roadmap is additive — more automation, fewer manual tasks, and a faster path to going live." },
    ],
  },
  {
    slug: "zoho-and-tally-integrations",
    title: "Zoho Books and Tally integrations are now live",
    excerpt:
      "Push guest folios and invoices to your accounting software automatically — no export, no re-keying.",
    date: "2026-07-01",
    category: "Product",
    body: [
      {
        text: "We've shipped direct integrations with Zoho Books and Tally so night-audit output flows straight into your accounting system.",
      },
      { heading: "What syncs", list: [
        "Guest folios and GST invoices after night audit",
        "Payments and refunds with reconciliation status",
        "Expense categories mapped to your chart of accounts",
      ]},
      { heading: "How to enable it", text: "Connect your accounting account in Settings → Integrations. Existing customers can turn it on today; new deployments include it at no extra cost." },
    ],
  },
  {
    slug: "soc-2-type-2",
    title: "HospiOS achieves SOC 2 Type 2",
    excerpt:
      "Independent audit confirms our security controls, uptime practices and data handling meet enterprise standards.",
    date: "2026-06-10",
    category: "Trust",
    body: [
      {
        text: "We're proud to share that HospiOS has completed a SOC 2 Type 2 audit, covering security, availability, processing integrity, confidentiality and privacy.",
      },
      { heading: "What this means for you", list: [
        "Enterprise-grade controls verified by an independent auditor",
        "Role-based access, 2FA and full audit trails you can rely on",
        "A security posture that satisfies corporate procurement teams",
      ]},
      { heading: "Full report", text: "Customers can request the report from their account. For details on our security architecture, see the dedicated security page." },
    ],
  },
  {
    slug: "free-score-public-rollout",
    title: "The free online presence score is now open to everyone",
    excerpt:
      "Check any property's visibility across OTAs, Google and reviews in under a minute — no sign-up required.",
    date: "2026-05-12",
    category: "Product",
    body: [
      {
        text: "Our online presence score — the same engine that tells HospiOS customers where to win — is now a free public tool. Type a property name, get a score and a prioritized action list.",
      },
      { heading: "Why we built it", text: "Most hotels don't know what they look like online until a guest tells them. A free, honest score turns 'improve visibility' from a feeling into a to-do list." },
      { heading: "Try it", text: "Head to the homepage and check any property. It's instant, free, and there's no account required." },
    ],
  },
];

export function getNewsItem(slug: string): NewsItem | undefined {
  return NEWS_ITEMS.find((n) => n.slug === slug);
}
