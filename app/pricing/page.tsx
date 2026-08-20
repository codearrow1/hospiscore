import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import SectionHeading from "@/components/marketing/SectionHeading";
import PricingCalculator from "@/components/marketing/PricingCalculator";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { PLANS } from "@/lib/pricing";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple per-room pricing from $8 per room/month. Core, Flex, Pro, and Ultra plans with a live price calculator and a free walkthrough.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Pricing · HospiOS",
    description:
      "Simple per-room pricing from $8 per room/month. Use the live calculator to see your exact cost.",
    images: [{ url: ogImage("Simple per-room pricing"), width: 1200, height: 630 }],
  },
};

const INCLUDES = [
  "Free online presence score",
  "Free walkthrough for your property",
  "Free property setup & data migration",
  "Mobile apps for Android & iOS",
  "24/7 support with onboarding help",
  "Cancel or change plans anytime",
];

const TABLE_ROWS: { label: string; values: [boolean, boolean, boolean, boolean] }[] = [
  { label: "PMS, booking engine & availability calendar", values: [true, true, true, true] },
  { label: "Housekeeping & maintenance", values: [true, true, true, true] },
  { label: "Guest CRM, profiles & stay history", values: [false, true, true, true] },
  { label: "Channel manager — 14+ OTAs", values: [false, true, true, true] },
  { label: "Group bookings & multi-property", values: [false, true, true, true] },
  { label: "Restaurant POS, KDS & QR menu", values: [false, false, true, true] },
  { label: "WhatsApp & communication center", values: [false, false, true, true] },
  { label: "AI check-in & AI reply drafts", values: [false, false, true, true] },
  { label: "Expense manager & daily audit", values: [false, false, true, true] },
  { label: "AI dynamic pricing & forecasting", values: [false, false, false, true] },
  { label: "Public API, webhooks & SSO", values: [false, false, false, true] },
  { label: "Dedicated success manager", values: [false, false, false, true] },
];

const PRICING_FAQS = [
  {
    q: "Is there a free plan?",
    a: "The free online presence score never requires a card or sign-up. Every paid plan includes a free walkthrough of your property, and you only pay when you go live.",
  },
  {
    q: "How is pricing calculated?",
    a: "It's per room, per month. Pick the band that matches your room count and a billing cycle — yearly billing gets two months free. There are no setup fees and no per-OTAs charges.",
  },
  {
    q: "Can I switch plans later?",
    a: "Anytime. Move between Core, Flex, Pro, and Ultra as you grow — modules switch on or off without losing any of your data.",
  },
  {
    q: "Do I need to sign a contract?",
    a: "No lock-in. Plans are month-to-month, and enterprise groups can add custom SLAs and dedicated support on request.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PRICING_FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Pricing"
          title="Simple per-room pricing"
          subtitle={
            <>
              From <span className="text-gradient font-semibold">$8 per room/month</span>.
              No setup fees, no per-channel charges, no long contracts. Use the
              calculator to see your exact monthly cost.
            </>
          }
        >
          <Link
            href="/demo"
            className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Book a demo
            <Icon name="trend" className="h-4 w-4" />
          </Link>
          <a
            href="#plans"
            className="glow-border inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
          >
            Compare plans
          </a>
        </PageHero>

        {/* Calculator */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <PricingCalculator />
        </section>

        {/* Every plan includes */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="What&apos;s included"
                title="Every plan comes with"
              />
            </Reveal>
            <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
              {INCLUDES.map((i, idx) => (
                <Reveal key={i} delay={idx * 60}>
                  <li className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-indigo-500/50 hover:bg-zinc-900/80">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-sm text-zinc-300">{i}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Comparison table */}
        <section id="plans" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Compare"
              title="Which plan fits your property?"
              subtitle="Start with Core and upgrade as you grow — every plan bills per room per month."
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12 overflow-x-auto rounded-3xl border border-zinc-800">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Feature
                  </th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="px-5 py-4 text-center">
                      <span className={`text-base font-bold ${p.featured ? "text-indigo-300" : "text-zinc-100"}`}>
                        {p.name}
                      </span>
                      <span className="block text-xs font-normal text-zinc-500">
                        ${p.perRoomUsd}/room/mo
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row, ri) => (
                  <tr
                    key={row.label}
                    className={`border-b border-zinc-800 last:border-0 ${ri % 2 ? "bg-zinc-900/40" : "bg-zinc-950"}`}
                  >
                    <td className="px-5 py-3.5 text-zinc-300">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-5 py-3.5 text-center">
                        {v ? (
                          <span className="inline-flex text-emerald-400">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-label="Included">
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-flex text-zinc-600">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Not included">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Reveal>
          <p className="mt-4 text-center text-xs text-zinc-500">
            Yearly billing = 2 months free on every plan.
          </p>
        </section>

        {/* Pricing FAQ */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading eyebrow="Pricing FAQ" title="Billing questions, answered" />
            </Reveal>
            <div className="mt-8 flex flex-col gap-4">
              {PRICING_FAQS.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-indigo-500/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-zinc-100">
                    {f.q}
                    <span className="shrink-0 text-zinc-500 transition group-open:rotate-45">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">Not sure which plan fits?</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Tell us about your property and we&apos;ll recommend a plan and walk
                  you through it live.
                </p>
              </div>
              <Link
                href="/demo"
                className="btn-shine btn-arrow inline-flex shrink-0 items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Book a demo
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
