import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SectionHeading from "@/components/marketing/SectionHeading";
import Faq from "@/components/marketing/Faq";
import Icon from "@/components/marketing/icons";
import { FAQS } from "@/lib/faq";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Answers to the questions hoteliers ask most — setup, migration, channels, pricing, security, and switching to HospiOS.",
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Help & FAQ · HospiOS",
    description:
      "Quick answers about HospiOS — setup, migration, channels, pricing and security.",
    images: [{ url: ogImage("Help & FAQ"), width: 1200, height: 630 }],
  },
};

const TOPICS = [
  { title: "Getting started", href: "/knowledge-base", icon: "dashboard" },
  { title: "Migration", href: "/migration", icon: "box" },
  { title: "Channels & OTAs", href: "/integrations", icon: "network" },
  { title: "Pricing & plans", href: "/pricing", icon: "coins" },
  { title: "Security & trust", href: "/security", icon: "shield" },
  { title: "Contact support", href: "/contact", icon: "chat" },
] as const;

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col">
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

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Help Center"
          title={
            <>
              Frequently asked <span className="text-gradient">questions</span>
            </>
          }
          subtitle="Straight answers to the questions hoteliers ask us most — about setup, migration, channels, pricing and security."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">FAQ</span>
            </nav>
          }
        >
          <Link
            href="/contact"
            className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Ask us anything
          </Link>
        </PageHero>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="Browse by topic"
            title="Find the answer you need"
            subtitle="Or jump straight into the interactive FAQ below."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t, i) => (
              <Reveal key={t.title} delay={i * 70}>
                <Link
                  href={t.href}
                  className="group flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-950/50 text-indigo-300 transition group-hover:bg-indigo-900/50">
                    <Icon name={t.icon} className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-zinc-100 transition group-hover:text-indigo-300">
                    {t.title}
                  </span>
                  <svg className="h-4 w-4 text-zinc-600 transition group-hover:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Interactive FAQ"
              title="The questions we hear every week"
            />
            <div className="mt-12">
              <Faq />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  Didn&apos;t find your answer?
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  A real person on our team responds within one business day.
                </p>
              </div>
              <Link
                href="/contact"
                className="btn-shine btn-arrow inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Contact support
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
