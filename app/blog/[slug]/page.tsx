import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { BLOG_POSTS, getPost } from "@/lib/posts";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: "en_US",
      title: post.title,
      description: post.excerpt,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.date,
      images: [{ url: ogImage(post.title), width: 1200, height: 630 }],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.date,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
          articleBody: post.body.map((s) => s.text ?? "").filter(Boolean).join(" "),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
            { "@type": "ListItem", position: 3, name: post.title },
          ],
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <article>
          <PageHero
            eyebrow="HospiOS Blog"
            title={post.title}
            align="left"
            top={
              <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
                <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
                <span className="mx-2">/</span>
                <Link href="/blog" className="link-underline hover:text-indigo-400">Blog</Link>
                <span className="mx-2">/</span>
                <span className="text-zinc-300">{post.category}</span>
              </nav>
            }
            subtitle={
              <>
                <span className="mt-0 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="rounded-full bg-indigo-950 px-3 py-1 font-semibold uppercase tracking-wide text-indigo-300">
                    {post.category}
                  </span>
                  <span>
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span>{post.readTime}</span>
                </span>
                <span className="mt-3 block">{post.excerpt}</span>
              </>
            }
          />

          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
            <div className="flex flex-col gap-8">
              {post.body.map((section, i) => (
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
                <h2 className="text-xl font-bold text-zinc-50">Put this into practice</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Book a demo and we&apos;ll set it up on your property — plus your
                  free online presence score.
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

            {related.length > 0 && (
              <div className="mt-12">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  Keep reading
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {related.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/60"
                    >
                      <p className="text-xs text-zinc-500">{p.category} · {p.readTime}</p>
                      <h3 className="mt-2 text-base font-semibold leading-snug text-zinc-100 transition group-hover:text-indigo-300">
                        {p.title}
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
