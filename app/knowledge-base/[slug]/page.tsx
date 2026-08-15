import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { KNOWLEDGE_ARTICLES, getArticle } from "@/lib/knowledge";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export function generateStaticParams() {
  return KNOWLEDGE_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/knowledge-base/${article.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: "en_US",
      title: article.title,
      description: article.excerpt,
      url: `${SITE_URL}/knowledge-base/${article.slug}`,
      publishedTime: article.updated,
      images: [{ url: ogImage(article.title), width: 1200, height: 630 }],
    },
  };
}

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = KNOWLEDGE_ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: article.title,
          description: article.excerpt,
          dateModified: article.updated,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          mainEntityOfPage: `${SITE_URL}/knowledge-base/${article.slug}`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Knowledge base", item: `${SITE_URL}/knowledge-base` },
            { "@type": "ListItem", position: 3, name: article.category },
          ],
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <article>
          <PageHero
            eyebrow={`Knowledge base · ${article.category}`}
            title={article.title}
            align="left"
            top={
              <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
                <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
                <span className="mx-2">/</span>
                <Link href="/knowledge-base" className="link-underline hover:text-indigo-400">Knowledge base</Link>
                <span className="mx-2">/</span>
                <span className="text-zinc-300">{article.category}</span>
              </nav>
            }
            subtitle={
              <>
                <span className="mt-0 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="rounded-full bg-indigo-950 px-3 py-1 font-semibold uppercase tracking-wide text-indigo-300">
                    {article.category}
                  </span>
                  <span>{article.readTime}</span>
                  <span>Updated {article.updated}</span>
                </span>
                <span className="mt-3 block">{article.excerpt}</span>
              </>
            }
          />

          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
            <div className="flex flex-col gap-8">
              {article.body.map((section, i) => (
                <Reveal key={i} delay={i % 2 ? 60 : 0}>
                  <section>
                    {section.heading && (
                      <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                        {section.heading}
                      </h2>
                    )}
                    {section.text && (
                      <p className="mt-3 text-base leading-relaxed text-zinc-400">
                        {section.text}
                      </p>
                    )}
                    {section.list && (
                      <ul className="mt-4 flex flex-col gap-3">
                        {section.list.map((li) => (
                          <li key={li} className="flex items-start gap-3">
                            <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                              </svg>
                            </span>
                            <span className="text-base leading-relaxed text-zinc-300">{li}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </Reveal>
              ))}
            </div>

            <Reveal delay={80}>
              <div className="glow-border mt-12 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center">
                <h2 className="text-xl font-bold text-zinc-50">Need a hand?</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Our support team is happy to walk you through it.
                </p>
                <Link
                  href="/contact"
                  className="btn-shine btn-arrow mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Contact support
                  <Icon name="chat" className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            {related.length > 0 && (
              <div className="mt-12">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  Related guides
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {related.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/knowledge-base/${a.slug}`}
                      className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/60"
                    >
                      <p className="text-xs text-zinc-500">{a.category} · {a.readTime}</p>
                      <h3 className="mt-2 text-base font-semibold leading-snug text-zinc-100 transition group-hover:text-indigo-300">
                        {a.title}
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
