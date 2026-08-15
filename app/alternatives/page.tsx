import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SectionHeading from "@/components/marketing/SectionHeading";
import Icon from "@/components/marketing/icons";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "HospiOS vs other PMS solutions",
  description:
    "See how HospiOS compares to Mews, Cloudbeds, Opera, Little Hotelier and the rest — all-in-one pricing, real OTA sync, and a built-in online presence score.",
  alternates: { canonical: "/alternatives" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "HospiOS vs other PMS solutions · HospiOS",
    description:
      "An honest comparison of all-in-one PMS platforms — features, pricing and lock-in.",
    images: [{ url: ogImage("HospiOS vs other PMS solutions"), width: 1200, height: 630 }],
  },
};

const COMPARE = [
  { feature: "All-in-one PMS + channel manager", hospios: true, others: "Often separate, extra fees" },
  { feature: "Built-in restaurant POS & kitchen display", hospios: true, others: "Add-on or missing" },
  { feature: "Finance, GST invoicing & night audit", hospios: true, others: "Add-on or missing" },
  { feature: "HRMS, housekeeping & maintenance", hospios: true, others: "Partial or separate" },
  { feature: "Free online presence score (no sign-up)", hospios: true, others: "Not offered" },
  { feature: "AI review replies & pricing recommendations", hospios: true, others: "New or premium" },
  { feature: "Two-way OTA sync in real time", hospios: true, others: "Usually included" },
  { feature: "Free guided migration", hospios: true, others: "Paid or DIY" },
  { feature: "Transparent per-room pricing", hospios: true, others: "Often opaque" },
];

const ALTERNATIVES = [
  { name: "Mews", note: "Great for hostels and modern hotels, but POS, finance and HR often come as paid add-ons." },
  { name: "Cloudbeds", note: "A strong all-rounder, though pricing scales fast with add-ons and the presence score isn't included." },
  { name: "Opera", note: "Enterprise-grade, but heavyweight, costly, and built for large chains more than independent properties." },
  { name: "Little Hotelier", note: "Simple and cheap for tiny properties, but limited as you grow into POS, finance and multi-property." },
  { name: "Frontdesk Anywhere", note: "Solid cloud PMS for small hotels; guest self-service and AI features are thinner." },
  { name: "Spreadsheets & separate tools", note: "Cheapest day one, most expensive every month after — re-keying, overbooking and blind spots cost real money." },
];

export default function AlternativesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "HospiOS vs other PMS solutions",
          url: "https://hospios.com/alternatives",
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Comparison"
          title={
            <>
              Honest talk about <span className="text-gradient">switching</span>
            </>
          }
          subtitle="We'll tell you when HospiOS fits and when it doesn't. If you run a multi-thousand-room chain or need heavy third-party customization, another tool may be better. For the other 95% of properties, here's the difference."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Alternatives</span>
            </nav>
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
            href="/free-score"
            className="link-underline text-sm font-semibold text-zinc-300 transition hover:text-zinc-50"
          >
            Or try the free score
          </Link>
        </PageHero>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Feature comparison"
              title="HospiOS vs other all-in-one PMSs"
              subtitle="Not every feature here matters to every property. The point is nothing on this list should cost extra."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-12 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60">
                      <th className="px-6 py-4 font-semibold text-zinc-400">Feature</th>
                      <th className="px-6 py-4 text-center font-semibold text-indigo-300">
                        HospiOS
                      </th>
                      <th className="px-6 py-4 font-semibold text-zinc-400">Other platforms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE.map((row, i) => (
                      <tr
                        key={row.feature}
                        className={`border-b border-zinc-800/60 ${i % 2 ? "bg-zinc-900/40" : ""}`}
                      >
                        <td className="px-6 py-4 font-medium text-zinc-200">{row.feature}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500">{row.others}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="The honest rundown"
              title="What we'd tell you about each option"
              subtitle="We compete on fit, not smears. Here's how each popular choice stacks up."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ALTERNATIVES.map((a, i) => (
                <Reveal key={a.name} delay={(i % 3) * 80}>
                  <div className="glow-border flex h-full flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                    <h2 className="text-base font-bold text-zinc-50">{a.name}</h2>
                    <p className="text-sm leading-relaxed text-zinc-400">{a.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">
                  See it on your own property
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Book a 30-minute demo and we&apos;ll set up HospiOS with your real
                  data — then decide with facts, not a sales deck.
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
