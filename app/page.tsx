import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PropertySearch from "@/components/PropertySearch";
import BookDemoForm from "@/components/BookDemoForm";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import FeatureCard from "@/components/marketing/FeatureCard";
import ModuleGrid from "@/components/marketing/ModuleGrid";
import CoreTools from "@/components/marketing/CoreTools";
import RealtimeFeed from "@/components/marketing/RealtimeFeed";
import ProductTour from "@/components/marketing/ProductTour";
import Security from "@/components/marketing/Security";
import Reveal from "@/components/marketing/Reveal";
import CountUp from "@/components/marketing/CountUp";
import RotatingWords from "@/components/marketing/RotatingWords";
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

const STATS: {
  to: number;
  suffix?: string;
  decimals?: number;
  label: string;
  icon: IconName;
  accent: string;
}[] = [
  { to: 500, suffix: "+", label: "properties onboarded", icon: "building", accent: "text-indigo-300 bg-indigo-500/15" },
  { to: 50, suffix: "+", label: "OTA channels in sync", icon: "network", accent: "text-sky-300 bg-sky-500/15" },
  { to: 23, label: "integrated modules", icon: "dashboard", accent: "text-violet-300 bg-violet-500/15" },
  { to: 4.9, decimals: 1, suffix: "/5", label: "average operator rating", icon: "star", accent: "text-amber-300 bg-amber-500/15" },
];

const PARTNERS: { name: string; icon: IconName }[] = [
  { name: "Boutique Hotels", icon: "star" },
  { name: "Resort Groups", icon: "building" },
  { name: "Hostels & B&Bs", icon: "users" },
  { name: "Vacation Rentals", icon: "key" },
  { name: "Serviced Apartments", icon: "box" },
  { name: "Budget Chains", icon: "coins" },
  { name: "Mountain Lodges", icon: "globe" },
  { name: "City Hotels", icon: "dashboard" },
  { name: "Island Resorts", icon: "sparkle" },
  { name: "Boutique Chains", icon: "network" },
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
                  <li
                    key={c}
                    className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-indigo-700 hover:text-indigo-200"
                  >
                    {c}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 animate-fade-up" style={{ animationDelay: "400ms" }}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex text-amber-400" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Icon key={i} name="star" className="h-3.5 w-3.5" />
                    ))}
                  </span>
                  4.9/5 from 2,000+ operators
                </span>
                <span className="hidden h-3 w-px bg-zinc-800 sm:block" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="shield" className="h-3.5 w-3.5 text-emerald-400" />
                  SOC 2 Type II · GDPR ready
                </span>
              </div>
            </div>

            <div className="relative animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-gradient-to-tr from-indigo-600/25 via-violet-600/10 to-sky-500/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 animate-spin-slower rounded-full opacity-60 blur-2xl"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent, rgba(99,102,241,0.35), rgba(56,189,248,0.25), transparent)",
                }}
              />

              <div className="relative overflow-hidden rounded-3xl border border-zinc-700/70 bg-zinc-900 shadow-2xl shadow-black/60">
                <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/90 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" aria-hidden="true" />
                  <span className="mx-auto flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1 text-[10px] font-medium text-zinc-400">
                    <Icon name="globe" className="h-3 w-3" />
                    app.hospios.com
                  </span>
                  <span className="w-6" aria-hidden="true" />
                </div>

                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1400&q=80"
                    alt="Resort pool at dusk — a property managed with HospiOS"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="hero-zoom object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/25 to-zinc-950/5"
                  />
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-zinc-950/70 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 backdrop-blur">
                      <span className="pulse-dot" aria-hidden="true" />
                      Live data
                    </span>
                    <span className="rounded-full border border-zinc-700 bg-zinc-950/70 px-2.5 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur">
                      84 · Good
                    </span>
                  </div>
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Harbor Lights Inn</p>
                      <p className="text-xs text-zinc-300">
                        Cornwall, UK · 1,240 reviews · 8 platforms
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-emerald-500 px-2 py-1 text-xs font-bold text-zinc-950">
                      ▲ +3 this week
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-7 -left-5 hidden w-44 rounded-2xl border border-zinc-700 bg-zinc-900/95 p-3.5 shadow-xl shadow-black/50 backdrop-blur animate-float-slow sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Tonight&apos;s occupancy
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-zinc-50">
                  78% <span className="text-xs font-semibold text-emerald-400">▲ +12%</span>
                </p>
                <div className="mt-2 flex h-8 items-end gap-1" aria-hidden="true">
                  {[35, 55, 42, 70, 62, 85, 78].map((h, i) => (
                    <div
                      key={i}
                      className="bar-grow flex-1 rounded-sm bg-indigo-500/70"
                      style={{ height: `${h}%`, animationDelay: `${0.15 * i + 0.3}s` }}
                    />
                  ))}
                </div>
              </div>

              <div className="absolute -top-5 -right-3 hidden w-56 rounded-2xl border border-zinc-700 bg-zinc-900/95 p-3.5 shadow-xl shadow-black/50 backdrop-blur toast-in sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  New booking
                </p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-100">
                  Deluxe King · 2 nights
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="pulse-dot" aria-hidden="true" />
                  Direct booking · $487 · 20:14
                </p>
              </div>

              <div className="absolute -bottom-4 right-8 hidden rounded-xl border border-indigo-900 bg-indigo-950/90 px-3.5 py-2.5 shadow-lg shadow-indigo-950/40 backdrop-blur animate-float sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                  AI reply draft
                </p>
                <p className="mt-0.5 text-xs text-indigo-100">
                  “Thank you for the lovely review…”
                </p>
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
            <Marquee duration={38}>
              {PARTNERS.map((p) => (
                <span
                  key={p.name}
                  className="mx-2.5 inline-flex items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-950/80 py-1.5 pl-1.5 pr-4 shadow-sm shadow-black/20"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/25 to-violet-500/25 text-indigo-300">
                    <Icon name={p.icon} className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold tracking-tight text-zinc-300">
                    {p.name}
                  </span>
                </span>
              ))}
            </Marquee>
          </div>
        </section>

        {/* ───────────────────────── Trust stats ───────────────────────── */}
        <section className="border-b border-zinc-800 bg-zinc-900/40">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-8 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80} from="scale">
                <div className="group text-center transition duration-300 hover:-translate-y-1">
                  <span
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl transition duration-300 group-hover:scale-110 ${s.accent}`}
                  >
                    <Icon name={s.icon} className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-50 transition group-hover:text-indigo-300">
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
              <div className="relative mt-12">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-3xl"
                />
                <div className="relative">
                  <ModuleGrid />
                </div>
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
                <div className="group relative h-full rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition duration-300 hover:-translate-y-1 hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-950/40">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
                  />
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-600/25 transition duration-300 group-hover:scale-110 group-hover:shadow-indigo-600/40">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-zinc-50">{s.title}</h3>
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
              <div className="glow-border relative overflow-hidden rounded-3xl shadow-2xl shadow-indigo-950/50">
                <Image
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80"
                  alt="Luxury resort pool at golden hour"
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-indigo-950/95 via-violet-950/85 to-zinc-950/90" />
                <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-60" />

                <div className="relative mx-auto max-w-2xl px-6 py-16 text-center sm:px-12">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100 backdrop-blur">
                    <span className="pulse-dot" aria-hidden="true" />
                    Live product demo · 30 minutes
                  </span>
                  <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    See HospiOS run your property
                  </h2>
                  <p className="mt-4 text-base text-indigo-100">
                    Book a 30-minute walkthrough. We&apos;ll set up your property
                    live — front desk, housekeeping, POS, and your free online
                    presence score.
                  </p>
                  <div className="mx-auto mt-8 max-w-md rounded-3xl border border-white/10 bg-zinc-950/70 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <BookDemoForm compact />
                  </div>
                </div>

                <div className="absolute -top-4 right-10 hidden animate-float rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-2.5 shadow-lg backdrop-blur md:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                    Front desk · 08:00
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-200">
                    24 check-ins today · all rooms clean
                  </p>
                </div>
                <div className="absolute -bottom-5 left-10 hidden animate-float-slow rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-2.5 shadow-lg backdrop-blur md:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Your online presence
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-zinc-100">
                    84/100 · Good · ▲ +3 this week
                  </p>
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
