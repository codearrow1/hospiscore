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
    slug: "ai-automation-every-department",
    title: "AI automation now spans every department",
    excerpt:
      "From AI reply drafts to pricing recommendations — automation covers front desk, housekeeping, F&B and revenue, with humans always in control.",
    date: "2026-07-20",
    category: "Company",
    body: [
      {
        text: "HospiOS AI now touches every department of the platform: an AI concierge and chatbot for guests, sentiment analysis on reviews, automated reply drafts, AI check-in, and pricing and inventory forecasts — with staff reviewing and approving every recommendation.",
      },
      { heading: "Where AI helps", list: [
        "AI reply drafts and guest-sentiment analysis for reviews",
        "AI pricing recommendations and revenue forecasting",
        "Predictive housekeeping and smart room allocation",
      ]},
      { heading: "What it means for customers", text: "More automation, fewer manual tasks, and a faster path to going live — with no change to plans or pricing." },
    ],
  },
  {
    slug: "accounting-exports-tally-quickbooks",
    title: "Accounting exports for Tally and QuickBooks are now available",
    excerpt:
      "Night-audit output flows straight into your accounting software — guest folios, GST invoices and payments, matched and reconciled.",
    date: "2026-07-01",
    category: "Product",
    body: [
      {
        text: "We've shipped direct exports to Tally and QuickBooks so night-audit output flows straight into your accounting system — no export, no re-keying.",
      },
      { heading: "What syncs", list: [
        "Guest folios and GST invoices after night audit",
        "Payments and refunds with reconciliation status",
        "Expense categories mapped to your chart of accounts",
      ]},
      { heading: "How to enable it", text: "Connect Tally or QuickBooks in Settings → Integrations. Existing customers can turn it on today; new deployments include it at no extra cost." },
    ],
  },
  {
    slug: "security-practices-published",
    title: "Security practices, published in plain language",
    excerpt:
      "How HospiOS encrypts data, controls access and logs activity — documented openly on our security page.",
    date: "2026-06-10",
    category: "Trust",
    body: [
      {
        text: "We've published how HospiOS protects property data: encryption at rest and in transit, role-based access control, two-factor authentication, activity logging, automated backups and data-residency options.",
      },
      { heading: "What this means for you", list: [
        "Data encrypted at rest and in transit",
        "Role-based access with two-factor authentication available",
        "Activity logs and automated backups",
      ]},
      { heading: "Learn more", text: "See the dedicated security page for the full picture of our security architecture and data-handling commitments." },
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
