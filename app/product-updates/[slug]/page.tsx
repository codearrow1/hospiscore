import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { UPDATES, getUpdate } from "@/lib/updates";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export function generateStaticParams() {
  return UPDATES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const update = getUpdate(slug);
  if (!update) return { title: "Update not found" };
  return {
    title: `${update.title} · ${update.version}`,
    description: update.excerpt,
    alternates: { canonical: `/product-updates/${update.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${update.title} · ${update.version}`,
      description: update.excerpt,
      url: `${SITE_URL}/product-updates/${update.slug}`,
      publishedTime: update.date,
      images: [{ url: ogImage(update.title), width: 1200, height: 630 }],
    },
  };
}

export default async function UpdatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const update = getUpdate(slug);
  if (!update) notFound();

  const more = UPDATES.filter((u) => u.slug !== update.slug).slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: `${update.title} · ${update.version}`,
          description: update.excerpt,
          datePublished: update.date,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          mainEntityOfPage: `${SITE_URL}/product-updates/${update.slug}`,
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <article>
          <PageHero
            eyebrow={`Changelog · ${update.version}`}
            title={update.title}
            align="left"
            top={
              <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
                <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
                <span className="mx-2">/</span>
                <Link href="/product-updates" className="link-underline hover:text-indigo-400">Product updates</Link>
                <span className="mx-2">/</span>
                <span className="text-zinc-300">{update.version}</span>
              </nav>
            }
            subtitle={
              <>
                <span className="mt-0 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="rounded-full bg-indigo-950 px-3 py-1 font-semibold uppercase tracking-wide text-indigo-300">
                    {update.version}
                  </span>
                  <span>
                    {new Date(update.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  {update.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </span>
                <span className="mt-3 block">{update.excerpt}</span>
              </>
            }
          />

          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
            <div className="flex flex-col gap-8">
              {update.body.map((section, i) => (
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
                <h2 className="text-xl font-bold text-zinc-50">Not on HospiOS yet?</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Every update here is included in your plan — see it live in a demo.
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
                  Recent updates
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {more.map((u) => (
                    <Link
                      key={u.slug}
                      href={`/product-updates/${u.slug}`}
                      className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/60"
                    >
                      <p className="text-xs text-zinc-500">{u.version} · {u.date}</p>
                      <h3 className="mt-2 text-base font-semibold leading-snug text-zinc-100 transition group-hover:text-indigo-300">
                        {u.title}
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
