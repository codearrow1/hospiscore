import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { CASE_STUDIES, getCaseStudy } from "@/lib/caseStudies";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) return { title: "Case study not found" };
  return {
    title: `${cs.company} · ${cs.headline}`,
    description: cs.summary,
    alternates: { canonical: `/case-studies/${cs.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${cs.company} · ${cs.headline}`,
      description: cs.summary,
      url: `${SITE_URL}/case-studies/${cs.slug}`,
      publishedTime: cs.date,
      images: [{ url: ogImage(cs.company), width: 1200, height: 630 }],
    },
  };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) notFound();

  const more = CASE_STUDIES.filter((c) => c.slug !== cs.slug).slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: cs.headline,
          description: cs.summary,
          datePublished: cs.date,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          mainEntityOfPage: `${SITE_URL}/case-studies/${cs.slug}`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Case studies", item: `${SITE_URL}/case-studies` },
            { "@type": "ListItem", position: 3, name: cs.company },
          ],
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <article>
          <PageHero
            eyebrow="Case study"
            title={cs.headline}
            align="left"
            top={
              <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
                <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
                <span className="mx-2">/</span>
                <Link href="/case-studies" className="link-underline hover:text-indigo-400">Case studies</Link>
                <span className="mx-2">/</span>
                <span className="text-zinc-300">{cs.company}</span>
              </nav>
            }
            subtitle={
              <>
                <span className="mt-0 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="rounded-full bg-indigo-950 px-3 py-1 font-semibold uppercase tracking-wide text-indigo-300">
                    {cs.sector}
                  </span>
                  <span className="rounded-full border border-zinc-700/70 bg-zinc-900 px-2.5 py-0.5 font-medium text-zinc-400">
                    Illustrative scenario
                  </span>
                  <span>{cs.location}</span>
                  <span>{cs.size}</span>
                  <span>
                    {new Date(cs.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                    })}
                  </span>
                </span>
                <span className="mt-3 block">{cs.summary}</span>
              </>
            }
          />

          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
            <Reveal>
              <div className="grid grid-cols-1 gap-3 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-7 sm:grid-cols-3 sm:gap-4">
                {cs.results.map((r) => (
                  <div key={r.metric} className="text-center">
                    <p className="text-2xl font-bold tabular-nums text-emerald-400 sm:text-3xl">
                      {r.value}
                    </p>
                    <p className="mt-1 text-xs font-medium text-zinc-300">{r.metric}</p>
                    <p className="text-[11px] text-zinc-500">{r.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="mt-10 flex flex-col gap-8">
              <Reveal>
                <section>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                    The challenge
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-zinc-400">{cs.challenge}</p>
                </section>
              </Reveal>
              <Reveal delay={60}>
                <section>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                    How HospiOS helped
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-zinc-400">{cs.approach}</p>
                </section>
              </Reveal>
            </div>

            <Reveal delay={60}>
              <div className="mt-10 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8">
                <blockquote>
                  <p className="text-lg font-medium leading-relaxed text-zinc-50">
                    “{cs.quote.text}”
                  </p>
                  <footer className="mt-4 text-sm text-zinc-400">
                    <span className="font-semibold text-indigo-300">{cs.quote.name}</span>
                    {" · "}
                    {cs.quote.role}
                  </footer>
                </blockquote>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-6 flex flex-wrap gap-2">
                {cs.tags.map((t) => (
                  <span key={t} className="rounded-full border border-zinc-700/70 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="glow-border mt-12 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center">
                <h2 className="text-xl font-bold text-zinc-50">Want the same for your property?</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Book a demo and we&apos;ll show you what running one platform
                  looks like on your property.
                </p>
                <Link
                  href="/demo"
                  className="btn-shine btn-arrow mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Book a demo
                  <Icon name="trend" className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            {more.length > 0 && (
              <div className="mt-12">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  More stories
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {more.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/case-studies/${c.slug}`}
                      className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/60"
                    >
                      <p className="text-xs text-zinc-500">{c.sector} · {c.size}</p>
                      <h3 className="mt-2 text-base font-semibold leading-snug text-zinc-100 transition group-hover:text-indigo-300">
                        {c.headline}
                      </h3>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
