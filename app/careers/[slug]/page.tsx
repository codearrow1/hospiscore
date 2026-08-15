import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { CAREER_ROLES, getCareerRole } from "@/lib/careers";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export function generateStaticParams() {
  return CAREER_ROLES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const role = getCareerRole(slug);
  if (!role) return { title: "Role not found" };
  return {
    title: `${role.title} · Careers at HospiOS`,
    description: role.summary,
    alternates: { canonical: `/careers/${role.slug}` },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${role.title} · HospiOS`,
      description: role.summary,
      url: `${SITE_URL}/careers/${role.slug}`,
      images: [{ url: ogImage(role.title), width: 1200, height: 630 }],
    },
  };
}

export default async function CareerRolePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const role = getCareerRole(slug);
  if (!role) notFound();

  const more = CAREER_ROLES.filter((r) => r.slug !== role.slug).slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: role.title,
          description: role.summary,
          datePosted: "2026-08-01",
          hiringOrganization: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "Remote" } },
          employmentType: "FULL_TIME",
          url: `${SITE_URL}/careers/${role.slug}`,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Careers", item: `${SITE_URL}/careers` },
            { "@type": "ListItem", position: 3, name: role.title },
          ],
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <article>
          <PageHero
            eyebrow={`Careers · ${role.team}`}
            title={role.title}
            align="left"
            top={
              <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
                <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
                <span className="mx-2">/</span>
                <Link href="/careers" className="link-underline hover:text-indigo-400">Careers</Link>
                <span className="mx-2">/</span>
                <span className="text-zinc-300">{role.title}</span>
              </nav>
            }
            subtitle={
              <>
                <span className="mt-0 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="rounded-full bg-indigo-950 px-3 py-1 font-semibold uppercase tracking-wide text-indigo-300">
                    {role.team}
                  </span>
                  <span>{role.location}</span>
                  <span>{role.type}</span>
                </span>
                <span className="mt-3 block">{role.summary}</span>
              </>
            }
          >
            <a
              href={`mailto:careers@hospios.dev?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
              className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Apply for this role
              <Icon name="chat" className="h-4 w-4" />
            </a>
          </PageHero>

          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
            <div className="flex flex-col gap-10">
              <Reveal>
                <section>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-50">
                    What you&apos;ll do
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {role.responsibilities.map((li) => (
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
                </section>
              </Reveal>

              <Reveal delay={60}>
                <section>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-50">
                    What we&apos;re looking for
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {role.requirements.map((li) => (
                      <li key={li} className="flex items-start gap-3">
                        <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                          </svg>
                        </span>
                        <span className="text-base leading-relaxed text-zinc-300">{li}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>

              {role.niceToHave && role.niceToHave.length > 0 && (
                <Reveal delay={100}>
                  <section>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-50">
                      Bonus points
                    </h2>
                    <ul className="mt-4 flex flex-col gap-3">
                      {role.niceToHave.map((li) => (
                        <li key={li} className="flex items-start gap-3">
                          <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                            </svg>
                          </span>
                          <span className="text-base leading-relaxed text-zinc-300">{li}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </Reveal>
              )}
            </div>

            <Reveal delay={80}>
              <div className="glow-border mt-12 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center">
                <h2 className="text-xl font-bold text-zinc-50">Sounds like you?</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Send us your CV and a note about what you&apos;d build in this role.
                </p>
                <a
                  href={`mailto:careers@hospios.dev?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
                  className="btn-shine btn-arrow mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Apply now
                  <Icon name="chat" className="h-4 w-4" />
                </a>
              </div>
            </Reveal>

            {more.length > 0 && (
              <div className="mt-12">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  Other open roles
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {more.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/careers/${r.slug}`}
                      className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/60"
                    >
                      <p className="text-xs text-zinc-500">{r.team} · {r.location}</p>
                      <h3 className="mt-2 text-base font-semibold leading-snug text-zinc-100 transition group-hover:text-indigo-300">
                        {r.title}
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
