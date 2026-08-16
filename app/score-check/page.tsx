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
import ScoreCheckWidget from "@/components/ScoreCheckWidget";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Check Your Property Score — Real Google Data, Worldwide",
  description:
    "Search any hotel, resort or B&B on Earth and get its online presence score from live Google data — ratings, review volume, visibility and more. Unlock the full report with one email.",
  alternates: { canonical: "/score-check" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Check Your Property Score — Live Google Data",
    description:
      "A real online presence score for any property worldwide, straight from Google Places. Free preview, instant full report.",
    images: [{ url: ogImage("Property Score Check"), width: 1200, height: 630 }],
  },
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "Search any property",
    body: "Type a hotel, resort or B&B name — anywhere in the world. We query live Google Places data in real time.",
  },
  {
    title: "See your free preview",
    body: "Watch the overall score appear instantly, alongside review counts and platform coverage.",
  },
  {
    title: "Unlock the full report",
    body: "Drop your email and the complete breakdown unlocks — every signal, your strengths and the fixes that move the score.",
  },
];

const REPORT_FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "chart",
    title: "13-signal breakdown",
    body: "Rating quality, review velocity, response rate, presence, amenities and more — each scored 0–100 and weighted by impact.",
  },
  {
    icon: "star",
    title: "Honest strengths",
    body: "See exactly what already works: the channels and services your guests reward today.",
  },
  {
    icon: "megaphone",
    title: "Prioritized watchouts",
    body: "The two or three fixes that would lift the score the most — ranked by impact, written in plain language.",
  },
  {
    icon: "globe",
    title: "Worldwide live data",
    body: "Powered by Google Places, enriched the minute you search. No curated sample, no demo property — your actual results.",
  },
];

const TRUST = [
  "Live Google Places data",
  "Any property worldwide",
  "Free score preview",
  "No credit card",
];

export default function ScoreCheckPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "HospiOS Property Score Check",
          url: "https://hospios.com/score-check",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <section className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-16 sm:px-6 sm:pt-20">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="pulse-dot" aria-hidden="true" />
                Live worldwide data · Google Places
              </span>
            </div>

            <h1 className="mt-6 text-center text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              What&apos;s your property&apos;s
              <span className="text-gradient"> online presence score?</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-zinc-400">
              Search any hotel, resort or B&amp;B — anywhere on Earth — and get its
              real score from live Google data in seconds. See the number free, then
              unlock the full breakdown with one email.
            </p>

            <div className="mx-auto mt-6 flex flex-wrap justify-center gap-2">
              {TRUST.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="glow-border mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl shadow-indigo-950/40 backdrop-blur sm:p-7">
              <ScoreCheckWidget />
            </div>

            <p className="mt-4 text-center text-xs text-zinc-500">
              Scores cover Google, Booking.com, TripAdvisor, Expedia, Airbnb and more.
              The full report is emailed to you instantly.
            </p>
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="How it works"
                title="Three steps. Under a minute."
                subtitle="No sign-up wall at the start — just search and see your number. The score speaks first, the detail follows."
              />
            </Reveal>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90}>
                  <TiltCard className="h-full rounded-3xl">
                    <SpotlightCard className="h-full rounded-3xl">
                      <div className="flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-950/50 text-sm font-bold text-indigo-300">
                          {i + 1}
                        </span>
                        <h2 className="mt-4 text-base font-bold text-zinc-50">{s.title}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                      </div>
                    </SpotlightCard>
                  </TiltCard>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Inside the full report"
              title="From one number to a to-do list"
              subtitle="The unlocked report isn’t a vanity metric — it’s a prioritized action plan for how your property looks online."
            />
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {REPORT_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="flex h-full gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-950/50 text-indigo-300">
                    <Icon name={f.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-zinc-50">{f.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-t border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Why scores matter"
                title="Guests read your score before they book"
                subtitle="Visitors compare you against the street. A strong, consistent online presence is the difference between “sounds nice” and a confirmed booking."
              />
            </Reveal>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {[
                { value: "92%", label: "of travelers check reviews before booking" },
                { value: "+4.9%", label: "average revenue lift from a 1-star rating gain" },
                { value: "6 min", label: "average time researching a hotel before booking" },
              ].map((s, i) => (
                <Reveal key={s.label} delay={i * 90}>
                  <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
                    <div className="text-gradient text-4xl font-bold tabular-nums">{s.value}</div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Not just a number"
              title="Score, then fix"
              subtitle="Once you know the number, HospiOS automates the biggest levers behind it — AI review replies, automated review requests and a booking engine guests actually find."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="glow-border mt-10 flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">Want the fixes handled for you?</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  See the score every day, get the action plan, and let HospiOS do the work.
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