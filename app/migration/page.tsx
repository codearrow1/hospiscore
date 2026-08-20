import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SectionHeading from "@/components/marketing/SectionHeading";
import SpotlightCard from "@/components/marketing/SpotlightCard";
import TiltCard from "@/components/marketing/TiltCard";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Switch from your current PMS",
  description:
    "Move to HospiOS in a day. Free guided migration from 20+ PMS providers — reservations, guest profiles, rate plans and channels, imported for you.",
  alternates: { canonical: "/migration" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Switch from your current PMS · HospiOS",
    description:
      "Free guided migration — most properties go live within a day.",
    images: [{ url: ogImage("Switch from your current PMS"), width: 1200, height: 630 }],
  },
};

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "chart",
    title: "Audit & plan",
    body: "We review what your current system holds — reservations, guest profiles, rate plans, OTA mapping — and agree the go-live date with your team.",
  },
  {
    icon: "box",
    title: "Import your data",
    body: "Your data is migrated by our team: bookings, stay history, guest preferences, documents, and configuration. Nothing important gets left behind.",
  },
  {
    icon: "frontdesk",
    title: "Go live on a pilot",
    body: "We run your pilot property on HospiOS, train the front desk, and support your first full night audit — live, with your real bookings.",
  },
  {
    icon: "trend",
    title: "Roll out & optimize",
    body: "Switch remaining properties, connect your channels, and turn on automation. You keep full access to old records for as long as you need.",
  },
];

const WHAT_YOU_IMPORT = [
  "Reservations, check-ins and stay history",
  "Guest profiles, preferences and documents",
  "Rate plans, promotions and OTA mapping",
  "Housekeeping and maintenance history",
  "Folios, invoices and open balances",
  "Corporate accounts and contact records",
];

const FROM_ANYONE = [
  "Mews",
  "Cloudbeds",
  "Opera",
  "Little Hotelier",
  "Frontdesk Anywhere",
  "eZee Absolute",
  "Lodgify",
  "Cloudinn",
  "Stayntouch",
  "Breezeway",
  "Herbert",
  "Duetto",
  "InnRoad",
  "Rezdy",
  "Sirvoy",
  "HolidayLets",
  "uHotel",
  "Oracle Hospitality",
  "RoomKey",
  "20+ providers",
];

export default function MigrationPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "HospiOS PMS Migration",
          url: `${SITE_URL}/migration`,
          serviceType: "Hotel PMS migration",
          provider: { "@type": "Organization", name: SITE_NAME },
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Switch to HospiOS"
          title={
            <>
              Move your property in <span className="text-gradient">one day</span>
            </>
          }
          subtitle="The fear of migration is what keeps properties stuck on software they've outgrown. We handle the data, the training and the first night audit — you keep running your hotel."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Migration</span>
            </nav>
          }
        >
          <Link
            href="/demo"
            className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Start your migration
            <Icon name="trend" className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="link-underline text-sm font-semibold text-zinc-300 transition hover:text-zinc-50"
          >
            See pricing
          </Link>
        </PageHero>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="The process"
            title="Four steps, zero drama"
            subtitle="A guided migration that fits around your operation — not the other way around."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <div className="flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950/50 text-indigo-300">
                          <Icon name={s.icon} className="h-5 w-5" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                          Step {i + 1}
                        </span>
                      </div>
                      <h2 className="mt-4 text-base font-bold text-zinc-50">{s.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                    </div>
                  </SpotlightCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <Reveal from="left">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                    Everything you imported, and more
                  </h2>
                  <p className="mt-4 leading-relaxed text-zinc-400">
                    Your records are your property. We bring them across intact, so
                    your team keeps its history and your guests keep their
                    preferences.
                  </p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {WHAT_YOU_IMPORT.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                          </svg>
                        </span>
                        <span className="text-base leading-relaxed text-zinc-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal from="right" delay={120}>
                <div className="glow-border rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8">
                  <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                    We&apos;ve migrated from
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {FROM_ANYONE.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-zinc-700/70 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-indigo-600 hover:text-zinc-100"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  Free migration with any paid plan
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Switch during your trial and keep the old system live in parallel
                  until you&apos;re confident. No lock-in, ever.
                </p>
              </div>
              <Link
                href="/demo"
                className="btn-shine btn-arrow inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Book a demo
                <Icon name="trend" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
