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
import { BLOG_POSTS } from "@/lib/posts";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Practical guides on hotel operations, revenue, and direct bookings from the HospiOS team.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Blog · HospiOS",
    description:
      "Practical guides on hotel operations, revenue, and direct bookings from the HospiOS team.",
    images: [{ url: ogImage("Hotel operations, revenue & technology"), width: 1200, height: 630 }],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Hotel Management": "text-sky-300 bg-sky-950/60",
  Revenue: "text-emerald-300 bg-emerald-950/60",
  Operations: "text-amber-300 bg-amber-950/60",
};

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "HospiOS Blog",
          url: "https://hospios.com/blog",
          blogPost: BLOG_POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            datePublished: p.date,
            url: `/blog/${p.slug}`,
          })),
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Blog"
          title={
            <>
              Hotel operations, <span className="text-gradient">revenue & technology</span>
            </>
          }
          subtitle={
            <>
              Practical, honest guides from the HospiOS team — no fluff, just
              what actually moves the needle for properties like yours.
            </>
          }
        />

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {BLOG_POSTS.map((post, i) => (
              <Reveal key={post.slug} delay={(i % 2) * 100} from={i % 2 === 0 ? "left" : "right"}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group relative flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-7 transition hover:border-indigo-500/60"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            CATEGORY_COLORS[post.category] ?? "text-zinc-300 bg-zinc-800"
                          }`}
                        >
                          {post.category}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(post.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="hidden text-xs text-zinc-600 sm:inline">{post.readTime}</span>
                      </div>
                      <h2 className="mt-4 text-xl font-bold leading-snug text-zinc-50 transition group-hover:text-indigo-300">
                        {post.title}
                      </h2>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                        {post.excerpt}
                      </p>
                      <span className="btn-arrow mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400">
                        Read article
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
                  Try the ideas above on your property
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Book a demo and we&apos;ll set it up live — plus your free online
                  presence score.
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
