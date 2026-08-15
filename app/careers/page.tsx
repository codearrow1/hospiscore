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
import type { IconName } from "@/components/marketing/icons";
import { CAREER_ROLES } from "@/lib/careers";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Careers at HospiOS",
  description:
    "Join the team building the all-in-one operating system for hospitality. Remote-first roles in engineering, design, customer success and marketing.",
  alternates: { canonical: "/careers" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Careers at HospiOS",
    description:
      "Remote-first roles building the operating system for hospitality.",
    images: [{ url: ogImage("Careers at HospiOS"), width: 1200, height: 630 }],
  },
};

const PERKS: { icon: IconName; title: string; body: string }[] = [
  { icon: "globe", title: "Remote-first", body: "Work from anywhere in overlapping time zones. We hire for outcome, not hours." },
  { icon: "trend", title: "Real impact", body: "Your work moves revenue for thousands of properties — and we ship daily." },
  { icon: "users", title: "Small, senior team", body: "You'll own real surface area and learn from people who've built at scale." },
  { icon: "coins", title: "Fair, transparent pay", body: "Benchmarked salaries, real equity, and a path to grow with the company." },
];

export default function CareersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "JobPosting",
          url: "https://hospios.com/careers",
          hiringOrganization: { "@type": "Organization", name: SITE_NAME },
          jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "US" } },
          employmentType: "FULL_TIME",
          title: "HospiOS careers",
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Careers"
          title={
            <>
              Help us build the <span className="text-gradient">operating system</span> for hospitality
            </>
          }
          subtitle="Hospitality runs on margins, and independent properties deserve enterprise-grade software. We're a small, senior, remote-first team shipping exactly that."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Careers</span>
            </nav>
          }
        />

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <div className="flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-950/50 text-indigo-300">
                        <Icon name={p.icon} className="h-5 w-5" />
                      </div>
                      <h2 className="mt-4 text-base font-bold text-zinc-50">{p.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
                    </div>
                  </SpotlightCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="grid gap-6">
              {CAREER_ROLES.map((r, i) => (
                <Reveal key={r.slug} delay={(i % 2) * 60}>
                  <Link
                    href={`/careers/${r.slug}`}
                    className="group flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:-translate-y-0.5 hover:border-indigo-500/60 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-zinc-50 transition group-hover:text-indigo-300">
                        {r.title}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">{r.summary}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-950 px-3 py-1 text-xs font-medium text-indigo-300">
                        {r.team}
                      </span>
                      <span className="rounded-full border border-zinc-700/70 px-3 py-1 text-xs font-medium text-zinc-300">
                        {r.location}
                      </span>
                      <span className="rounded-full border border-zinc-700/70 px-3 py-1 text-xs font-medium text-zinc-300">
                        {r.type}
                      </span>
                      <svg className="h-5 w-5 text-zinc-600 transition group-hover:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  Don&apos;t see your role?
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  We&apos;re always happy to meet great people. Send us a note and tell
                  us what you&apos;d build.
                </p>
              </div>
              <Link
                href="/contact"
                className="btn-shine btn-arrow inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Say hello
                <Icon name="chat" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
