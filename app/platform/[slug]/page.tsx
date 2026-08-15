import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import {
  MODULE_CATEGORIES,
  PMS_MODULES,
  type PmsModule,
} from "@/lib/modules";
import { FEATURE_CONTENT, MODULE_ALIASES } from "@/lib/featurePages";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

function resolveModule(slug: string): PmsModule | undefined {
  const id = MODULE_ALIASES[slug] ?? slug;
  return PMS_MODULES.find((m) => m.id === id);
}

export function generateStaticParams() {
  const slugs = new Set<string>();
  for (const m of PMS_MODULES) slugs.add(m.id);
  for (const alias of Object.keys(MODULE_ALIASES)) slugs.add(alias);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = resolveModule(slug);
  if (!mod) return { title: "Module not found" };
  const content = FEATURE_CONTENT[mod.id];
  return {
    title: mod.name,
    description:
      content?.intro ??
      `${mod.tagline} The ${mod.name} module is part of the all-in-one HospiOS hotel management platform.`,
    alternates: { canonical: `/platform/${slug}` },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${mod.name} · HospiOS`,
      description:
        content?.intro ?? `${mod.tagline} Part of the HospiOS all-in-one hotel PMS.`,
      url: `${SITE_URL}/platform/${slug}`,
      images: [{ url: ogImage(content?.headline ?? mod.name), width: 1200, height: 630 }],
    },
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = resolveModule(slug);
  if (!mod) notFound();

  const content = FEATURE_CONTENT[mod.id];
  const category = MODULE_CATEGORIES.find((c) => c.id === mod.category);
  const related = PMS_MODULES.filter(
    (m) => m.category === mod.category && m.id !== mod.id
  ).slice(0, 5);
  const faqs = content?.faqs ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Platform", item: `${SITE_URL}/platform` },
            { "@type": "ListItem", position: 3, name: mod.name },
          ],
        }}
      />
      {faqs.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }}
        />
      )}
      <Header />

      <main id="main" className="flex-1">
        {/* Hero */}
        <PageHero
          eyebrow={category?.label ?? "Platform"}
          title={content?.headline ?? mod.tagline}
          align="left"
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <Link href="/platform" className="link-underline hover:text-indigo-400">Platform</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">{mod.name}</span>
            </nav>
          }
          subtitle={
            <>
              <span className="mt-0 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-900 bg-indigo-950 px-3 py-1 text-xs font-medium text-indigo-300">
                  <Icon name={category?.icon ?? "dashboard"} className="h-3.5 w-3.5" />
                  {category?.label ?? "Platform"}
                </span>
                <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
                  {mod.name}
                </span>
              </span>
              <span className="mt-3 block text-lg leading-relaxed">
                {content?.intro ??
                  `The ${mod.name} module is part of the ${category?.label.toLowerCase() ?? "platform"} — designed to keep every detail in sync with the rest of your property in real time.`}
              </span>
            </>
          }
        >
          <Link
            href="/demo"
            className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Book a demo
            <Icon name="trend" className="h-4 w-4" />
          </Link>
          <Link
            href="/#check-score"
            className="glow-border inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
          >
            Check your free score
            <Icon name="star" className="h-4 w-4 text-amber-400" />
          </Link>
        </PageHero>

        {/* Highlights */}
        {content && (
          <section className="border-b border-zinc-800 bg-zinc-900/40 py-16">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="grid gap-5 md:grid-cols-3">
                {content.highlights.map((h, i) => (
                  <Reveal key={h.title} delay={i * 90}>
                    <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:-translate-y-0.5 hover:border-indigo-500/60">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                        <Icon name="sparkle" className="h-5 w-5" />
                      </span>
                      <h2 className="mt-4 text-lg font-semibold text-zinc-50">{h.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{h.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* What's included */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <Reveal>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                  What&apos;s included
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50">
                  Everything in {mod.name}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-zinc-400">
                  Part of the {category?.label ?? "platform"} category. Every
                  module shares the same guest, room, and revenue data — so nothing
                  is ever re-keyed and reports always reconcile.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href="/platform"
                    className="glow-border inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
                  >
                    All {PMS_MODULES.length} modules
                    <Icon name="trend" className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </Reveal>

            <ul className="grid gap-3 sm:grid-cols-2">
              {mod.bullets.map((b, i) => (
                <Reveal key={b} delay={(i % 4) * 60}>
                  <li className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-emerald-500/50">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-sm text-zinc-300">{b}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQs */}
        {faqs.length > 0 && (
          <section className="border-y border-zinc-800 bg-zinc-900/40 py-16">
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
              <Reveal>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                  {mod.name} — questions, answered
                </h2>
              </Reveal>
              <div className="mt-8 flex flex-col gap-4">
                {faqs.map((f) => (
                  <details
                    key={f.q}
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-indigo-500/50"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-zinc-100">
                      {f.q}
                      <span className="shrink-0 text-zinc-500 transition group-open:rotate-45">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Related modules */}
        {related.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
                More from {category?.label}
              </h2>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {related.map((m, i) => (
                <Reveal key={m.id} delay={(i % 5) * 60}>
                  <Link
                    href={`/platform/${m.id}`}
                    className="group block rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-1 hover:border-indigo-500/60"
                  >
                    <h3 className="text-sm font-semibold text-zinc-100 transition group-hover:text-indigo-300">
                      {m.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{m.tagline}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="border-t border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">See {mod.name} live</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  We&apos;ll set it up on your own property data and score your
                  online presence for free.
                </p>
              </div>
              <Link
                href="/demo"
                className="btn-shine inline-flex shrink-0 items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
