import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import SectionHeading from "@/components/marketing/SectionHeading";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import PricingExperience from "@/components/pricing/PricingExperience";
import { PLANS, PRICING_FAQS, EVERY_PLAN_INCLUDES } from "@/lib/pricing/catalog";
import { buildPricingSnapshot } from "@/lib/pricing/snapshot";
import { resolveCountry } from "@/lib/pricing/engine";
import { BILLING_COUNTRY_COOKIE } from "@/lib/pricing/countries";
import { SITE_NAME, ogImage } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hotel Management Software Pricing | HospiOS",
  description:
    "Simple, transparent hotel management software pricing for hotels, resorts, homestays and hospitality businesses. Plans tailored to your property size and local market.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Hotel Management Software Pricing | HospiOS",
    description:
      "Five plans for properties of every size, priced per country. See localized prices for your market instantly.",
    images: [{ url: ogImage("Pricing that fits your market"), width: 1200, height: 630 }],
  },
};

const PLAN_GUIDANCE = [
  {
    id: "solopreneur",
    who: "Homestays, B&Bs, guesthouses, Airbnb-style operators and very small independent properties.",
    fits: "Up to 6 rooms · 1 admin + 5 staff",
  },
  {
    id: "starter",
    who: "Small hotels and growing guesthouses selling across channels.",
    fits: "Up to 15 rooms · 2 admins + 10 staff",
  },
  {
    id: "growth",
    who: "Growing hotels with multiple departments and revenue operations.",
    fits: "Up to 40 rooms · 5 admins + 25 staff",
  },
  {
    id: "professional",
    who: "Full-service hotels, resorts and larger properties with restaurant and inventory.",
    fits: "Up to 100 rooms · 10 admins + 75 staff",
  },
  {
    id: "enterprise",
    who: "Hotel groups, chains, resorts and multi-property operators.",
    fits: "Custom scale · group-wide controls",
  },
];

const LOCALIZED_POINTS = [
  {
    title: "Fair pricing for local markets",
    body: "Prices are adapted to local purchasing power and market conditions — not to daily exchange rates. Your subscription price is based on the country selected for billing.",
  },
  {
    title: "Independently set, per country",
    body: "Every country has its own commercial pricing profile: prices, taxes and payment methods are configured by market — never converted at runtime.",
  },
  {
    title: "Protected pricing for customers",
    body: "Pricing is versioned. If we ever adjust prices, existing subscriptions keep the version they started on unless you explicitly agree to a change.",
  },
  {
    title: "Your billing country decides",
    body: "Changing the country on this page updates the prices shown. At checkout we validate the billing country and price server-side, so the amount you pay matches the plan you book.",
  },
];

export default async function PricingPage() {
  const [store, head] = await Promise.all([cookies(), headers()]);
  const snapshot = await buildPricingSnapshot();
  const initial = resolveCountry(head, store.get(BILLING_COUNTRY_COOKIE)?.value);

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
        {/* 1 · Hero */}
        <PageHero
          eyebrow="Pricing"
          title="Powerful Hotel Management. Pricing That Fits Your Market."
          subtitle="Run your property with one powerful hospitality platform. Choose the plan that fits your property size, team and operational needs — with pricing localized for your country."
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

        {/* 2–5, 7, 10, 11 · Country selector, billing toggle, cards, calculator,
            compare matrix, tax/payment (interactive, same snapshot) */}
        <PricingExperience snapshot={snapshot} initial={initial} />

        {/* 6 · Which plan is right for me? */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Plan guidance"
                title="Which plan is right for me?"
                subtitle="Pick by property size and team — every plan covers the full property operation, just at a different scale and depth."
              />
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {PLANS.map((p, idx) => (
                <Reveal key={p.id} delay={idx * 60}>
                  <div
                    className={`flex h-full flex-col rounded-2xl border p-5 ${
                      p.featured
                        ? "border-indigo-500/70 bg-indigo-950/30"
                        : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    <h3 className={`font-semibold ${p.featured ? "text-indigo-300" : "text-zinc-50"}`}>
                      {p.name}
                    </h3>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400">
                      {PLAN_GUIDANCE.find((g) => g.id === p.id)?.who}
                    </p>
                    <p className="mt-3 text-xs font-medium text-zinc-500">
                      {PLAN_GUIDANCE.find((g) => g.id === p.id)?.fits}
                    </p>
                    <a
                      href="#plans"
                      className={`mt-4 text-sm font-semibold transition ${
                        p.featured ? "text-indigo-300 hover:text-indigo-200" : "text-zinc-300 hover:text-white"
                      }`}
                    >
                      See pricing →
                    </a>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 8 · What's included in every plan */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="What's included"
                title="Every plan comes with"
                subtitle="No setup fees, no per-channel charges, no long contracts."
              />
            </Reveal>
            <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
              {EVERY_PLAN_INCLUDES.map((i, idx) => (
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

        {/* 9 · Localized pricing explanation */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Localized pricing"
                title="Why does pricing vary by country?"
                subtitle="HospiOS uses fair localized pricing so hospitality businesses in every market can run on one modern platform — while staying sustainable as a global product."
              />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LOCALIZED_POINTS.map((p, idx) => (
                <Reveal key={p.title} delay={idx * 60}>
                  <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-indigo-500/50">
                    <h3 className="text-sm font-semibold text-zinc-50">{p.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{p.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 12 · Enterprise CTA */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">Running a group or a chain?</h2>
                <p className="mt-1 max-w-xl text-sm text-zinc-400">
                  Enterprise brings a central reservation system, group-level
                  finance and inventory, SSO, custom integrations and a
                  dedicated account manager — scoped for your operation.
                </p>
              </div>
              <Link
                href="/demo?plan=enterprise"
                className="btn-shine btn-arrow inline-flex shrink-0 items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Talk to Sales
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* 13 · FAQ */}
        <section className="border-t border-zinc-800 py-16">
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

        {/* 14 · Final CTA */}
        <section className="border-t border-zinc-800 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">Not sure which plan fits?</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Tell us about your property and we&apos;ll recommend a plan —
                  with your local pricing — and walk you through it live.
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