import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { UPDATES } from "@/lib/updates";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Product Updates",
  description:
    "The HospiOS changelog — every feature we ship, explained in plain language.",
  alternates: { canonical: "/product-updates" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Product Updates · HospiOS",
    description:
      "The HospiOS changelog — every feature we ship.",
    images: [{ url: ogImage("Product Updates"), width: 1200, height: 630 }],
  },
};

export default function ProductUpdatesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "HospiOS Product Updates",
          url: "${SITE_URL}/product-updates",
          hasPart: UPDATES.map((u) => ({
            "@type": "Article",
            headline: u.title,
            url: `${SITE_URL}/product-updates/${u.slug}`,
          })),
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Changelog"
          title={
            <>
              Every update, <span className="text-gradient">explained</span>
            </>
          }
          subtitle="We ship constantly and we write it all down. Here's everything that's landed in the platform — new features, fixes and the thinking behind them."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Product updates</span>
            </nav>
          }
        />

        <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-5">
            {UPDATES.map((u, i) => (
              <Reveal key={u.slug} delay={(i % 2) * 60}>
                <Link
                  href={`/product-updates/${u.slug}`}
                  className="group flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:-translate-y-0.5 hover:border-indigo-500/60 sm:flex-row sm:gap-6"
                >
                  <span className="shrink-0 rounded-xl bg-indigo-950 px-3 py-1.5 text-center">
                    <span className="block text-xs font-bold tabular-nums text-indigo-300">
                      {u.version}
                    </span>
                    <span className="block text-[10px] text-zinc-500">
                      {new Date(u.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold leading-snug text-zinc-50 transition group-hover:text-indigo-300">
                        {u.title}
                      </h2>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{u.excerpt}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {u.tags.map((t) => (
                        <span key={t} className="rounded-full border border-zinc-700/70 bg-zinc-900 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg className="ml-auto h-5 w-5 shrink-0 self-center text-zinc-600 transition group-hover:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="glow-border mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  Want to see it live?
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Book a demo and we&apos;ll walk you through the latest features on
                  your property.
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
