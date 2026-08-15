import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { PMS_MODULES } from "@/lib/modules";
import { SOLUTIONS, getSolution } from "@/lib/solutions";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sol = getSolution(slug);
  if (!sol) return { title: "Solution not found" };
  return {
    title: sol.name,
    description: sol.tagline,
    alternates: { canonical: `/solutions/${sol.slug}` },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${sol.name} · HospiOS`,
      description: sol.tagline,
      url: `${SITE_URL}/solutions/${sol.slug}`,
      images: [{ url: ogImage(sol.headline), width: 1200, height: 630 }],
    },
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sol = getSolution(slug);
  if (!sol) notFound();

  const featuredModules = PMS_MODULES.filter((m) => sol.moduleIds.includes(m.id));

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Solutions", item: `${SITE_URL}/solutions` },
            { "@type": "ListItem", position: 3, name: sol.name },
          ],
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Solutions"
          title={sol.headline}
          align="left"
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <Link href="/solutions" className="link-underline hover:text-indigo-400">Solutions</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">{sol.name}</span>
            </nav>
          }
          subtitle={
            <>
              <span className="mt-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
                <Icon name={sol.icon} className="h-7 w-7" />
              </span>
              <span className="mt-3 block text-lg leading-relaxed">{sol.intro}</span>
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

        {/* Stats */}
        <section className="border-b border-zinc-800 bg-zinc-900/40">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
            {sol.stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <div className="text-center">
                  <p className="text-3xl font-bold tracking-tight text-zinc-50">{s.value}</p>
                  <p className="mt-1 text-sm text-zinc-500">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Challenges */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              The problems we solve
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50">
              Built to remove the friction in {sol.name.toLowerCase()}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {sol.challenges.map((c, i) => (
              <Reveal key={c.title} delay={i * 90}>
                <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:-translate-y-0.5 hover:border-indigo-500/60">
                  <span className="text-3xl font-bold text-indigo-950" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-zinc-50">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section className="border-y border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                Modules in play
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50">
                The HospiOS modules behind it
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredModules.map((m, i) => (
                <Reveal key={m.id} delay={(i % 4) * 70}>
                  <Link
                    href={`/platform/${m.id}`}
                    className="group block rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-1 hover:border-indigo-500/60"
                  >
                    <h3 className="text-sm font-semibold text-zinc-100 transition group-hover:text-indigo-300">
                      {m.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{m.tagline}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="glow-border rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 sm:p-12">
              <Icon name="star" className="h-6 w-6 text-amber-400" />
              <blockquote className="mt-4 max-w-3xl text-xl font-medium leading-relaxed text-zinc-100 sm:text-2xl">
                “{sol.testimonial.quote}”
              </blockquote>
              <footer className="mt-6">
                <p className="font-semibold text-zinc-50">{sol.testimonial.name}</p>
                <p className="text-sm text-zinc-400">{sol.testimonial.role}</p>
              </footer>
            </div>
          </Reveal>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  See HospiOS for {sol.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  We&apos;ll configure a live demo on your property and score your
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
