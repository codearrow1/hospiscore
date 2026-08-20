import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SpotlightCard from "@/components/marketing/SpotlightCard";
import TiltCard from "@/components/marketing/TiltCard";
import Icon from "@/components/marketing/icons";
import { CASE_STUDIES } from "@/lib/caseStudies";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "Typical operator journeys, illustrated — how hotels, resorts, apartments and glamping sites run on HospiOS.",
  alternates: { canonical: "/case-studies" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Case Studies · HospiOS",
    description:
      "Typical operator journeys — how properties run on HospiOS.",
    images: [{ url: ogImage("HospiOS Case Studies"), width: 1200, height: 630 }],
  },
};

export default function CaseStudiesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "HospiOS Case Studies",
          url: "${SITE_URL}/case-studies",
          hasPart: CASE_STUDIES.map((c) => ({
            "@type": "Article",
            headline: c.headline,
            url: `${SITE_URL}/case-studies/${c.slug}`,
          })),
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Customer journeys"
          title={
            <>
              How teams run <span className="text-gradient">on HospiOS</span>
            </>
          }
          subtitle="Hotels, resorts, apartments and glamping sites — the challenge, the switch, and what changes when everything runs in one platform. These are illustrative scenarios, not claims about named deployments."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Case studies</span>
            </nav>
          }
        />

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {CASE_STUDIES.map((c, i) => (
              <Reveal key={c.slug} delay={(i % 2) * 100} from={i % 2 === 0 ? "left" : "right"}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <Link
                      href={`/case-studies/${c.slug}`}
                      className="group relative flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-7 transition hover:border-indigo-500/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <span className="rounded-full bg-indigo-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                          {c.sector}
                        </span>
                        <span className="rounded-full border border-zinc-700/70 bg-zinc-900 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
                          Illustrative scenario
                        </span>
                        <span className="text-xs text-zinc-500">
                          {c.size} · {c.location}
                        </span>
                      </div>
                      <h2 className="mt-4 text-xl font-bold leading-snug text-zinc-50 transition group-hover:text-indigo-300">
                        {c.headline}
                      </h2>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                        {c.summary}
                      </p>
                      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-5 sm:gap-3">
                        {c.results.map((r) => (
                          <div key={r.metric}>
                            <p className="text-base font-bold tabular-nums text-emerald-400 sm:text-lg">
                              {r.value}
                            </p>
                            <p className="text-[10px] leading-tight text-zinc-500 sm:text-[11px]">{r.label}</p>
                          </div>
                        ))}
                      </div>
                      <span className="btn-arrow mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400">
                        Read the story
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                      </span>
                    </Link>
                  </SpotlightCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="glow-border mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  Your property could be next
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Book a demo and see what running one platform would look like
                  for your rooms.
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
