import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PropertySearch from "@/components/PropertySearch";
import BookDemoForm from "@/components/BookDemoForm";
import Icon from "@/components/marketing/icons";
import FeatureCard from "@/components/marketing/FeatureCard";
import ModuleGrid from "@/components/marketing/ModuleGrid";
import CoreTools from "@/components/marketing/CoreTools";
import RealtimeFeed from "@/components/marketing/RealtimeFeed";
import ProductTour from "@/components/marketing/ProductTour";
import Security from "@/components/marketing/Security";
import Reveal from "@/components/marketing/Reveal";
import CountUp from "@/components/marketing/CountUp";
import RotatingWords from "@/components/marketing/RotatingWords";
import SpotlightCard from "@/components/marketing/SpotlightCard";
import Marquee from "@/components/marketing/Marquee";
import SectionHeading from "@/components/marketing/SectionHeading";
import SolutionsStrip from "@/components/marketing/SolutionsStrip";
import IntegrationBar from "@/components/marketing/IntegrationBar";
import Support from "@/components/marketing/Support";
import Showcase from "@/components/marketing/Showcase";
import Pricing from "@/components/marketing/Pricing";
import Faq from "@/components/marketing/Faq";
import Testimonials from "@/components/marketing/Testimonials";
import Footer from "@/components/marketing/Footer";
import { FAQS } from "@/lib/faq";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: ogImage(`${SITE_NAME} — ${SITE_TAGLINE}`), width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [ogImage(`${SITE_NAME} — ${SITE_TAGLINE}`)],
  },
};

const STATS = [
  { to: 500, suffix: "+", label: "properties onboarded" },
  { to: 50, suffix: "+", label: "OTA channels in sync" },
  { to: 23, label: "integrated modules" },
  { to: 4.9, decimals: 1, suffix: "/5", label: "average operator rating" },
];

const HERO_CHIPS = [
  "Front Desk",
  "Housekeeping",
  "Restaurant POS",
  "Channel Manager",
  "HRMS & Payroll",
  "AI Automation",
];

const DIFFERENTIATORS = [
  {
    icon: <Icon name="building" />,
    title: "Enterprise-grade cloud",
    body: "Modular, scalable, and secure by design — from a single homestay to a global hotel group.",
    accent: "indigo" as const,
  },
  {
    icon: <Icon name="network" />,
    title: "Real-time OTA sync",
    body: "Inventory, rates, and restrictions stay in perfect two-way sync across 50+ channels.",
    accent: "sky" as const,
  },
  {
    icon: <Icon name="ai" />,
    title: "AI-powered automation",
    body: "AI concierge, pricing recommendations, sentiment analysis, and predictive housekeeping built in.",
    accent: "violet" as const,
  },
  {
    icon: <Icon name="plug" />,
    title: "Modular & extensible",
    body: "Switch modules on as you grow. A public REST API and webhooks connect anything else.",
    accent: "emerald" as const,
  },
  {
    icon: <Icon name="shield" />,
    title: "Role-based security",
    body: "20+ roles with granular permissions, two-factor auth, and full audit trails.",
    accent: "rose" as const,
  },
  {
    icon: <Icon name="smartphone" />,
    title: "Mobile-first & PWA-ready",
    body: "Every module works beautifully on any device — ready for your team in the field.",
    accent: "amber" as const,
  },
];

const STEPS = [
  {
    n: "01",
    title: "Configure",
    body: "Set up rooms, rate plans, and the modules you need. Most properties are ready within a day.",
  },
  {
    n: "02",
    title: "Connect",
    body: "Sync your OTAs, payment gateways, calendars, and your team with granular roles.",
  },
  {
    n: "03",
    title: "Run & grow",
    body: "Your staff works in one system; your leadership sees occupancy, revenue, and alerts live.",
  },
];

const ROLES = [
  "Super Admin",
  "Property Owner",
  "General Manager",
  "Front Office Manager",
  "Receptionist",
  "Housekeeping Supervisor",
  "Chef",
  "Accountant",
  "HR Manager",
  "Marketing Executive",
  "Concierge",
  "Security",
  "Guest",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Android, iOS",
          description: SITE_DESCRIPTION,
          url: SITE_URL,
          offers: { "@type": "Offer", price: "8", priceCurrency: "USD" },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <Header />

      <main id="main">
        {/* ───────────────────────── Hero ───────────────────────── */}
        <section className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950">
          <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-900/40 via-violet-900/25 to-transparent blur-3xl animate-glow" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-20 sm:px-6 lg:grid-cols-2 lg:pb-20 lg:pt-24">
            <div>
              <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-900 bg-indigo-950 px-3 py-1 text-xs font-medium text-indigo-300">
                  <span className="pulse-dot" aria-hidden="true" />
                  The all-in-one Hotel PMS
                </span>
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
                <span className="animate-fade-up block" style={{ animationDelay: "80ms" }}>
                  You focus on guests.{" "}
                  <span className="text-gradient">
                    HospiOS{" "}
                    <RotatingWords
                      words={["runs the rest.", "syncs everything.", "handles the busywork."]}
                      className="text-zinc-50"
                    />
                  </span>
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400 animate-fade-up" style={{ animationDelay: "160ms" }}>
                Front desk, reservations, housekeeping, restaurant POS, finance,
                HRMS, channel manager, and AI automation — every part of your
                property unified in a single cloud platform. Built for hotels,
                resorts, homestays, hostels, and multi-property groups.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4 animate-fade-up" style={{ animationDelay: "240ms" }}>
                <Link
                  href="/demo"
                  className="btn-shine inline-flex items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Book a demo
                </Link>
                <a
                  href="#check-score"
                  className="glow-border inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
                >
                  Check your free score
                  <Icon name="star" className="h-4 w-4 text-amber-400" />
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap gap-2 animate-fade-up" aria-label="Modules" style={{ animationDelay: "320ms" }}>
                {HERO_CHIPS.map((c) => (
                  <li key={c} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative animate-fade-up" style={{ animationDelay: "200ms" }}>
              <SpotlightCard className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-indigo-950/40">
                <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  What you&apos;ll see — free example score
                </p>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-800/60 p-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-50">Harbor Lights Inn</p>
                    <p className="text-xs text-zinc-400">Coastal hotel · Cornwall, UK</p>
                  </div>
                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-bold text-emerald-300">
                    84 · Good
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-800 rounded-2xl border border-zinc-800 text-center">
                  {[
                    { v: "1,240", l: "reviews" },
                    { v: "8", l: "platforms" },
                    { v: "▲ +3", l: "this week" },
                  ].map((s) => (
                    <div key={s.l} className="px-2 py-3">
                      <p className="text-sm font-bold tabular-nums text-zinc-50">{s.v}</p>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{s.l}</p>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
              <div className="absolute -bottom-5 -left-4 hidden animate-float-slow rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-lg sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">AI reply draft</p>
                <p className="text-xs text-zinc-300">“Thank you for your honest feedback…”</p>
              </div>
              <div className="absolute -right-3 -top-4 hidden animate-float rounded-xl border border-indigo-900 bg-indigo-950 px-4 py-3 shadow-lg sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">23 modules</p>
                <p className="text-xs font-medium text-indigo-200">One platform · zero re-keying</p>
              </div>
            </div>
          </div>

          {/* ── Hero search band ── */}
          <div id="check-score" className="relative mx-auto w-full max-w-3xl scroll-mt-24 px-4 pb-20 sm:px-6">
            <div className="glow-border rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-indigo-950/40 sm:p-6">
              <p className="mb-3 text-center text-sm font-semibold text-zinc-50">
                Search any property to check its free online presence score
              </p>
              <PropertySearch />
              <p className="mt-3 text-center text-xs text-zinc-500">
                No sign-up needed. Scores cover Google, Booking.com, TripAdvisor,
                Expedia, Airbnb and more.
              </p>
            </div>
          </div>
        </section>

        {/* ───────────────────────── Partners marquee ───────────────────────── */}
        <section className="border-b border-zinc-800 bg-zinc-900/30 py-10">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Powering properties everywhere
            </p>
            <Marquee duration={36}>
              {["Boutique Hotels", "Resort Groups", "Hostels & B&Bs", "Vacation Rentals", "Serviced Apartments", "Budget Chains", "Mountain Lodges", "City Hotels", "Island Resorts", "Boutique Chains"].map((t) => (
                <span key={t} className="mx-3 text-lg font-bold tracking-tight text-zinc-700 dark:text-zinc-600">
                  {t}
                </span>
              ))}
            </Marquee>
          </div>
        </section>

        {/* ───────────────────────── Trust stats ───────────────────────── */}
        <section className="border-b border-zinc-800 bg-zinc-900/40">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80} from="scale">
                <div className="group text-center transition duration-300 hover:-translate-y-1">
                  <p className="text-3xl font-bold tracking-tight text-zinc-50 transition group-hover:text-indigo-300">
                    <CountUp to={s.to} suffix={s.suffix ?? ""} decimals={s.decimals ?? 0} />
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ───────────────────────── Core tools ───────────────────────── */}
        <section className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Core hospitality tools"
              title="The three tools every property runs on"
              subtitle="Booking engine, PMS, and channel manager — built as one system so they never disagree with each other."
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12">
              <CoreTools />
            </div>
          </Reveal>
        </section>

        {/* ───────────────────────── Modules ───────────────────────── */}
        <section id="platform" className="border-y border-zinc-800 bg-zinc-900/40 py-20">
          <div className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="One platform"
                title="Every department, every operation, in one place"
                subtitle="23 modules covering operations, guest experience, food & beverage, back-of-house, finance, growth, and enterprise — configured to fit exactly how you run your property."
              />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-12">
                <ModuleGrid />
              </div>
            </Reveal>
            <div className="mt-10 text-center">
              <Link
                href="/platform"
                className="btn-arrow inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
              >
                Explore all 23 modules in detail
                <Icon name="trend" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ───────────────────────── Real-time feed ───────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal from="left">
              <div>
                <SectionHeading
                  eyebrow="Real-time platform"
                  title="Your entire operation, updating live"
                  subtitle="Rates reconciled, payments posted, rooms turned — every change flows through the whole platform in seconds. Front desk and housekeeping never have to wait on a message or a call."
                  align="left"
                />
                <ul className="mt-8 flex flex-col gap-3">
                  {[
                    ["Two-way OTA sync", "Rates, inventory and restrictions move both ways across every channel."],
                    ["Instant housekeeping handoffs", "Check-out creates a cleaning task the moment the guest leaves."],
                    ["Alerts before problems", "Overbooking risk, rate parity and anomaly alerts fire automatically."],
                  ].map(([t, b]) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" /></svg>
                      </span>
                      <div>
                        <p className="font-medium text-zinc-100">{t}</p>
                        <p className="text-sm leading-relaxed text-zinc-400">{b}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150} from="right">
              <RealtimeFeed />
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── Product tour ───────────────────────── */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Product tour"
                title="See the platform, room by room"
                subtitle="Click through the screens your team will actually use — dashboard, front desk, housekeeping, revenue, guests and the stay calendar."
              />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-12">
                <ProductTour />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── Free tool / score ───────────────────────── */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-20">
          <div id="score" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Free tool"
                title="See what HospiOS sees — your online presence score"
                subtitle="Before you run the full platform, try the free score: HospiOS reads your reviews and visibility across every channel and shows you exactly what needs attention."
              />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-12">
                <Showcase />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── How it works ───────────────────────── */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="From search to full operations in minutes"
            />
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100} from={i === 0 ? "left" : i === 2 ? "right" : "up"}>
                <div className="group relative rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition duration-300 hover:-translate-y-1 hover:border-indigo-500/50">
                  <span className="text-4xl font-bold text-indigo-950 transition duration-300 group-hover:text-indigo-900" aria-hidden="true">
                    {s.n}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-zinc-50">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ───────────────────────── Solutions ───────────────────────── */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Solutions"
                title="Built for every kind of property"
                subtitle="From a 12-bed hostel to a 200-key group portfolio — HospiOS shapes itself around how you actually run things."
              />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-12">
                <SolutionsStrip />
              </div>
            </Reveal>
            <div className="mt-8 text-center">
              <Link
                href="/solutions"
                className="btn-arrow inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
              >
                Explore all solutions
                <Icon name="trend" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ───────────────────────── Differentiators ───────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Why HospiOS"
              title="Built for hospitality, engineered like enterprise"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIATORS.map((d, i) => (
              <Reveal key={d.title} delay={i * 80} from="scale">
                <FeatureCard icon={d.icon} title={d.title} body={d.body} accent={d.accent} />
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="mx-auto mt-12 max-w-2xl">
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
                20+ roles with granular role-based access
              </p>
              <ul className="flex flex-wrap justify-center gap-2">
                {ROLES.map((r) => (
                  <li key={r} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-800">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ───────────────────────── Security ───────────────────────── */}
        <Security />

        {/* ───────────────────────── Testimonials ───────────────────────── */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Loved by operators"
                title="From boutique B&Bs to global portfolios"
              />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-12">
                <Testimonials />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── Support ───────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Support"
              title="Support that actually supports you"
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12">
              <Support />
            </div>
          </Reveal>
        </section>

        {/* ───────────────────────── Pricing ───────────────────────── */}
        <section id="pricing" className="border-y border-zinc-800 bg-zinc-900/40 py-20">
          <div className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Pricing"
                title="Plans that scale with your portfolio"
                subtitle="Start with one property, grow to hundreds. Every plan includes a free walkthrough."
              />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-12">
                <Pricing />
              </div>
            </Reveal>
            <div className="mt-8 text-center">
              <Link
                href="/pricing"
                className="btn-arrow inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
              >
                Calculate your exact price
                <Icon name="coins" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ───────────────────────── FAQ ───────────────────────── */}
        <section id="faq" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="FAQ"
              title="Questions, answered"
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12">
              <Faq />
            </div>
          </Reveal>
        </section>

        {/* ───────────────────────── Integrations ───────────────────────── */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Integrations"
                title="Works with the tools you already use"
                subtitle="OTAs, payment gateways, calendars, hardware and accounting — connected through one API-first platform."
              />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-12">
                <IntegrationBar />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────────────────────── Final CTA ───────────────────────── */}
        <section className="py-20">
          <Reveal>
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="glow-border relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800 px-6 py-16 text-center shadow-xl sm:px-12">
                <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 animate-glow rounded-full bg-white/10 blur-2xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 animate-glow rounded-full bg-white/10 blur-2xl" />
                <div className="relative mx-auto max-w-2xl">
                  <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    See HospiOS run your property
                  </h2>
                  <p className="mt-4 text-base text-indigo-100">
                    Book a 30-minute walkthrough. We&apos;ll set up your property
                    live — front desk, housekeeping, POS, and your free online
                    presence score.
                  </p>
                  <div className="mx-auto mt-8 max-w-md rounded-3xl bg-zinc-950/90 p-6 text-left shadow-lg">
                    <BookDemoForm compact />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
