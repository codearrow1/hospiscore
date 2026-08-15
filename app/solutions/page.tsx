import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import SectionHeading from "@/components/marketing/SectionHeading";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SpotlightCard from "@/components/marketing/SpotlightCard";
import TiltCard from "@/components/marketing/TiltCard";
import Icon from "@/components/marketing/icons";
import { SOLUTIONS } from "@/lib/solutions";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "HospiOS is built for hotels, hotel groups, hostels, and vacation rentals — one all-in-one PMS shaped around how you run your property.",
};

export default function SolutionsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Solutions"
          title={
            <>
              One platform, <span className="text-gradient">every kind of property</span>
            </>
          }
          subtitle={
            <>
              Whether you run a 12-bed hostel or a 200-key group portfolio,
              HospiOS shapes itself around how you actually operate.
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
        </PageHero>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {SOLUTIONS.map((s, i) => (
              <Reveal key={s.slug} delay={i * 90} from={i % 2 === 0 ? "left" : "right"}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <Link
                      href={`/solutions/${s.slug}`}
                      className="group relative block h-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 transition hover:border-indigo-500/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300 transition group-hover:bg-indigo-500/20">
                          <Icon name={s.icon} className="h-6 w-6" />
                        </span>
                        <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-500">
                          {s.moduleIds.length} modules
                        </span>
                      </div>
                      <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-50">{s.name}</h2>
                      <p className="mt-2 text-base leading-relaxed text-zinc-400">{s.tagline}</p>
                      <span className="btn-arrow mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400">
                        Explore {s.name}
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                      </span>
                    </Link>
                  </SpotlightCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-t border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Every solution, same core"
                title="Your modules follow you"
                subtitle="Switch between property types without re-platforming — the 23 core modules stay the same, configured to your operations."
              />
            </Reveal>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {[
                "Front Desk",
                "Reservations",
                "Housekeeping",
                "Channel Manager",
                "Restaurant POS",
                "Finance & Audit",
                "Guest CRM",
                "AI Automation",
              ].map((m) => (
                <span key={m} className="rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-indigo-500/50 hover:text-zinc-50">
                  {m}
                </span>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/demo"
                className="btn-shine inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Book a demo
                <Icon name="trend" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
