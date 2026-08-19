import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SectionHeading from "@/components/marketing/SectionHeading";
import UiMock from "@/components/marketing/UiMock";
import type { UiMockVariant } from "@/components/marketing/UiMock";
import Icon from "@/components/marketing/icons";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Product Videos",
  description:
    "Short, honest product walkthroughs — see how HospiOS handles front desk, housekeeping, revenue and guest experience in action.",
  alternates: { canonical: "/product-videos" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Product Videos · HospiOS",
    description:
      "Short walkthroughs of the HospiOS platform in action.",
    images: [{ url: ogImage("Product Videos"), width: 1200, height: 630 }],
  },
};

const VIDEOS: { title: string; duration: string; variant: UiMockVariant; summary: string }[] = [
  {
    title: "Dashboard in 60 seconds",
    duration: "1:02",
    variant: "dashboard",
    summary: "Live KPIs, arrivals, housekeeping status and alerts — the command center your whole team runs on.",
  },
  {
    title: "Front desk: check-in to checkout",
    duration: "2:15",
    variant: "frontdesk",
    summary: "Room board, express check-in, folios and the daily audit — one screen, no re-keying.",
  },
  {
    title: "Housekeeping turnaround, halved",
    duration: "1:45",
    variant: "housekeeping",
    summary: "Auto-generated tasks, mobile checklists and instant room-ready status between checkout and check-in.",
  },
  {
    title: "Revenue: dynamic pricing in action",
    duration: "1:58",
    variant: "revenue",
    summary: "AI price recommendations, simulation before publish, and length-of-stay rules that protect ADR.",
  },
  {
    title: "Guest experience from their phone",
    duration: "1:30",
    variant: "guest",
    summary: "Digital check-in, room service, concierge and payments — the self-service portal guests love.",
  },
  {
    title: "Availability & the booking calendar",
    duration: "1:12",
    variant: "calendar",
    summary: "One live calendar that every channel, room and rate plan feeds into — no more double bookings.",
  },
];

export default function ProductVideosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "HospiOS Product Videos",
          url: "https://hospios.com/product-videos",
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Product walkthroughs"
          title={
            <>
              See HospiOS <span className="text-gradient">in action</span>
            </>
          }
          subtitle="Short, honest walkthroughs of the platform — how the front desk, housekeeping, revenue and guest experience actually feel in daily use."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Product videos</span>
            </nav>
          }
        >
          <Link
            href="/demo"
            className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Book a live demo
            <Icon name="trend" className="h-4 w-4" />
          </Link>
        </PageHero>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {VIDEOS.map((v, i) => (
              <Reveal key={v.title} delay={(i % 3) * 80}>
                <div className="group flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:-translate-y-0.5 hover:border-indigo-500/60">
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                    <UiMock variant={v.variant} />
                    <Link
                      href="/demo"
                      aria-label={`Watch ${v.title} — or book a live demo instead`}
                      className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 transition hover:bg-zinc-950/50"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-xl transition group-hover:scale-110">
                        <svg className="ml-0.5 h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86Z" />
                        </svg>
                      </span>
                    </Link>
                    <span className="absolute right-2 top-2 rounded-full bg-zinc-950/80 px-2 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur">
                      {v.duration}
                    </span>
                  </div>
                  <div className="p-3">
                    <h2 className="text-base font-bold text-zinc-50">{v.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{v.summary}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <SectionHeading
              eyebrow="Why watch, when you can try"
              title="See it on your own property"
              subtitle="A live demo is better than any video — we configure HospiOS with your real rooms and rates in the session."
            />
          </Reveal>
          <Reveal delay={140}>
            <div className="glow-border mt-10 flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center sm:flex-row sm:text-left">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">Ready to go live?</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  30 minutes, your data, a live walkthrough. No deck.
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
