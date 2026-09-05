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
import { KNOWLEDGE_ARTICLES } from "@/lib/knowledge";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Knowledge Base",
  description:
    "Guides for running your property on HospiOS — setup, channels, night audit, housekeeping and revenue.",
  alternates: { canonical: "/knowledge-base" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Knowledge Base · HospiOS",
    description:
      "Guides for running your property on HospiOS.",
    images: [{ url: ogImage("Knowledge Base"), width: 1200, height: 630 }],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Getting Started": "text-emerald-300 bg-emerald-950/60",
  Channels: "text-sky-300 bg-sky-950/60",
  Finance: "text-amber-300 bg-amber-950/60",
  Revenue: "text-indigo-300 bg-indigo-950/60",
  Housekeeping: "text-rose-300 bg-rose-950/60",
};

export default function KnowledgeBasePage() {
  const categories = Array.from(new Set(KNOWLEDGE_ARTICLES.map((a) => a.category)));

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "HospiOS Knowledge Base",
          url: `${SITE_URL}/knowledge-base`,
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Help Center"
          title={
            <>
              Run your property with <span className="text-gradient">confidence</span>
            </>
          }
          subtitle="Step-by-step guides for setting up and running HospiOS — from first login to night audit to your first direct booking."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Knowledge base</span>
            </nav>
          }
        >
          <Link
            href="/faq"
            className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Browse the FAQ
          </Link>
        </PageHero>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {KNOWLEDGE_ARTICLES.map((a, i) => (
              <Reveal key={a.slug} delay={(i % 3) * 80}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <Link
                      href={`/knowledge-base/${a.slug}`}
                      className="group relative flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-indigo-500/60"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            CATEGORY_COLORS[a.category] ?? "text-zinc-300 bg-zinc-800"
                          }`}
                        >
                          {a.category}
                        </span>
                        <span className="text-xs text-zinc-500">{a.readTime}</span>
                      </div>
                      <h2 className="mt-4 text-lg font-bold leading-snug text-zinc-50 transition group-hover:text-indigo-300">
                        {a.title}
                      </h2>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                        {a.excerpt}
                      </p>
                      <span className="btn-arrow mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400">
                        Read guide
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                      </span>
                    </Link>
                  </SpotlightCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="mt-16">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                Browse by category
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span
                    key={c}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                      CATEGORY_COLORS[c] ?? "text-zinc-300 bg-zinc-800"
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="glow-border mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  Stuck on something specific?
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Our support team answers within one business day.
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
