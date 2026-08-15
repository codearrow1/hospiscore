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
import { NEWS_ITEMS } from "@/lib/news";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "News & Announcements",
  description:
    "Company news, product announcements and milestones from the HospiOS team.",
  alternates: { canonical: "/news" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "News & Announcements · HospiOS",
    description:
      "Company news and product announcements from HospiOS.",
    images: [{ url: ogImage("News & Announcements"), width: 1200, height: 630 }],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Company: "text-sky-300 bg-sky-950/60",
  Product: "text-indigo-300 bg-indigo-950/60",
  Trust: "text-emerald-300 bg-emerald-950/60",
};

export default function NewsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "HospiOS News",
          url: "https://hospios.com/news",
          blogPost: NEWS_ITEMS.map((n) => ({
            "@type": "NewsArticle",
            headline: n.title,
            datePublished: n.date,
            url: `/news/${n.slug}`,
          })),
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="News & Announcements"
          title={
            <>
              What&apos;s new <span className="text-gradient">at HospiOS</span>
            </>
          }
          subtitle="Product launches, milestones and company news — straight from the team, no press-release padding."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">News</span>
            </nav>
          }
        />

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {NEWS_ITEMS.map((n, i) => (
              <Reveal key={n.slug} delay={(i % 2) * 100} from={i % 2 === 0 ? "left" : "right"}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <Link
                      href={`/news/${n.slug}`}
                      className="group relative flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-7 transition hover:border-indigo-500/60"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            CATEGORY_COLORS[n.category] ?? "text-zinc-300 bg-zinc-800"
                          }`}
                        >
                          {n.category}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(n.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <h2 className="mt-4 text-xl font-bold leading-snug text-zinc-50 transition group-hover:text-indigo-300">
                        {n.title}
                      </h2>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                        {n.excerpt}
                      </p>
                      <span className="btn-arrow mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400">
                        Read more
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
                  See what&apos;s new in the product
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Every feature ships with a changelog entry — read the latest
                  updates.
                </p>
              </div>
              <Link
                href="/product-updates"
                className="btn-shine btn-arrow inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Product updates
                <Icon name="sparkle" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
