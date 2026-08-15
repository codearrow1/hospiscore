import Link from "next/link";

const TIERS = [
  {
    name: "Starter",
    monthly: "$49",
    cadence: "/month / property",
    blurb: "For single properties getting off manual systems.",
    cta: "Book a demo",
    featured: false,
    features: [
      "1 property, up to 5 staff",
      "Front desk, reservations & room board",
      "Housekeeping & maintenance",
      "Guest CRM essentials",
      "Free online presence score",
      "Email support",
    ],
  },
  {
    name: "Growth",
    monthly: "$129",
    cadence: "/month / property",
    blurb: "For growing portfolios running full operations on one platform.",
    cta: "Book a demo",
    featured: true,
    features: [
      "Up to 5 properties, unlimited staff",
      "Everything in Starter, plus:",
      "Restaurant POS, KDS & QR menu",
      "Channel manager — 12+ OTAs",
      "Finance, night audit & BI reports",
      "Guest self-service portal",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    monthly: "Custom",
    cadence: "annual contracts",
    blurb: "For multi-property groups, resorts, and hotel chains.",
    cta: "Talk to sales",
    featured: false,
    features: [
      "Unlimited properties & staff",
      "Everything in Growth, plus:",
      "HRMS, payroll & multi-property reporting",
      "Revenue management & AI pricing",
      "AI concierge & automation suite",
      "SSO, 2FA & full audit logs",
      "Dedicated success manager, API & webhooks",
    ],
  },
];

export default function Pricing() {
  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className={`relative flex flex-col rounded-3xl border p-7 transition duration-300 hover:-translate-y-1 ${
            tier.featured
              ? "glow-border border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-600/20"
              : "border-zinc-200 bg-white hover:border-indigo-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
          }`}
        >
          {tier.featured && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Most popular
            </span>
          )}
          <h3 className={`text-lg font-semibold ${tier.featured ? "text-white" : "text-zinc-900 dark:text-zinc-50"}`}>
            {tier.name}
          </h3>
          <p className={`mt-2 text-sm ${tier.featured ? "text-indigo-100" : "text-zinc-500 dark:text-zinc-400"}`}>
            {tier.blurb}
          </p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">{tier.monthly}</span>
            <span className={`text-sm ${tier.featured ? "text-indigo-100" : "text-zinc-400"}`}>
              {tier.cadence}
            </span>
          </div>

          <ul className={`mt-6 flex flex-1 flex-col gap-2.5 text-sm ${tier.featured ? "text-indigo-50" : "text-zinc-600 dark:text-zinc-300"}`}>
            {tier.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <svg className={`mt-0.5 h-4 w-4 shrink-0 ${tier.featured ? "text-white" : "text-emerald-500"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/demo"
            className={`btn-shine btn-arrow mt-7 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
              tier.featured
                ? "bg-white text-indigo-700 hover:bg-indigo-50"
                : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            }`}
          >
            {tier.cta}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      ))}
    </div>
  );
}
