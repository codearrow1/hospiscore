import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import PropertySearch from "@/components/PropertySearch";
import Reveal from "@/components/marketing/Reveal";
import SectionHeading from "@/components/marketing/SectionHeading";
import SpotlightCard from "@/components/marketing/SpotlightCard";
import TiltCard from "@/components/marketing/TiltCard";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Online Presence Score",
  description:
    "See exactly how visible your property is online in under a minute. Free score across Google, Booking.com, TripAdvisor, Expedia and Airbnb — no sign-up needed.",
  alternates: { canonical: "/free-score" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Free Online Presence Score · HospiOS",
    description:
      "Check any property's online visibility in under a minute — free, no sign-up.",
    images: [{ url: ogImage("Free Online Presence Score"), width: 1200, height: 630 }],
  },
};

const FACTORS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "star",
    title: "Ratings & volume",
    body: "Your average rating and review count across every major platform — and how that compares to local competitors.",
  },
  {
    icon: "globe",
    title: "Channel visibility",
    body: "Whether guests can find and book you on Google Hotels, Booking.com, Airbnb, TripAdvisor, Expedia and Agoda.",
  },
  {
    icon: "megaphone",
    title: "Response activity",
    body: "How often and how fast you reply to reviews — a proven lever for ranking and guest trust.",
  },
  {
    icon: "chart",
    title: "Direct signals",
    body: "Your own website's bookability and online presence strength, so you know where direct demand is leaking.",
  },
];

const WHAT_YOU_GET = [
  "One clear score out of 100, benchmarked against similar properties",
  "Prioritized fixes ranked by score impact",
  "Component breakdown: ratings, channels, response rate, direct",
  "A snapshot you can re-check any time to track progress",
  "Zero sign-up, zero email required to see your score",
];

export default function FreeScorePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "HospiOS Free Online Presence Score",
          url: "https://hospios.com/free-score",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Free tool"
          title={
            <>
              What do guests see when they <span className="text-gradient">search you?</span>
            </>
          }
          subtitle="The HospiOS online presence score reads your reviews and visibility across every major channel — then tells you, in plain language, exactly what needs attention. Free, and it takes under a minute."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Free score</span>
            </nav>
          }
        />

        <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
          <div className="glow-border rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-indigo-950/40 sm:p-7">
            <p className="mb-4 text-center text-lg font-bold text-zinc-50">
              Search any property to check its free online presence score
            </p>
            <PropertySearch />
            <p className="mt-4 text-center text-xs text-zinc-500">
              No sign-up needed. Scores cover Google, Booking.com, TripAdvisor,
              Expedia, Airbnb and more.
            </p>
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="The score explained"
                title="Four factors, one honest number"
                subtitle="Most properties have no idea what they look like online. We break the mystery into four measurable factors."
              />
            </Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {FACTORS.map((f, i) => (
                <Reveal key={f.title} delay={i * 90}>
                  <TiltCard className="h-full rounded-3xl">
                    <SpotlightCard className="h-full rounded-3xl">
                      <div className="flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-950/50 text-indigo-300">
                          <Icon name={f.icon} className="h-5 w-5" />
                        </div>
                        <h2 className="mt-4 text-base font-bold text-zinc-50">{f.title}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
                      </div>
                    </SpotlightCard>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal from="left">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                  More than a number — a to-do list
                </h2>
                <p className="mt-4 leading-relaxed text-zinc-400">
                  A score alone doesn&apos;t move your revenue. That&apos;s why every score
                  comes with prioritized fixes — the two or three changes that
                  would move your score the most, ranked by impact.
                </p>
                <ul className="mt-6 flex flex-col gap-3">
                  {WHAT_YOU_GET.map((item) => (
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
              <div className="glow-border rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                      Example score
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">The Royal Sandpiper</p>
                  </div>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-xl font-bold text-emerald-300">
                    74
                  </span>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  {[
                    { label: "Ratings & volume", value: 82, color: "bg-emerald-500" },
                    { label: "Channel visibility", value: 88, color: "bg-indigo-500" },
                    { label: "Response activity", value: 41, color: "bg-amber-500" },
                    { label: "Direct signals", value: 63, color: "bg-sky-500" },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                        <span>{row.label}</span>
                        <span className="tabular-nums text-zinc-300">{row.value}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs leading-relaxed text-zinc-500">
                  Response activity is the biggest drag here — replying to reviews
                  faster would lift the overall score more than anything else.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
                <div>
                  <h2 className="text-xl font-bold text-zinc-50">
                    Want the fixes handled for you?
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    HospiOS automates the biggest levers — AI review replies, review
                    requests after check-out, and a booking engine guests can find.
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
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
