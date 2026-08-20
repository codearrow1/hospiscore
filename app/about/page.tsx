import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import SectionHeading from "@/components/marketing/SectionHeading";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SpotlightCard from "@/components/marketing/SpotlightCard";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";

export const metadata: Metadata = {
  title: "About us",
  description:
    "HospiOS is the all-in-one cloud PMS for hotels, resorts, hostels, and property groups — with a free online presence score to get started.",
};

const VALUES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "frontdesk",
    title: "Operators first",
    body: "We build with hoteliers, not for them. Every module starts from a real shift on a real front desk.",
  },
  {
    icon: "network",
    title: "Everything in sync",
    body: "One source of truth for rooms, guests, and revenue — no duplicate entry, no re-keying, ever.",
  },
  {
    icon: "ai",
    title: "AI that earns trust",
    body: "Automation that suggests, never decides alone. Humans stay in control of every recommendation.",
  },
  {
    icon: "shield",
    title: "Security by design",
    body: "Role-based access, activity logging, and automated backups on every plan, from day one.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="About us"
          title={
            <>
              We&apos;re building the operating system for{" "}
              <span className="text-gradient">modern hospitality</span>
            </>
          }
          align="left"
          subtitle={
            <>
              HospiOS started with a simple observation: hotels run their most
              important work across six different tools and a pile of
              spreadsheets. We set out to unify every department — front desk,
              housekeeping, kitchen, finance, HR, and distribution — into one
              intelligent platform, with a free online presence score to prove
              how much a single source of truth changes the game.
            </>
          }
        />

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="What we believe"
              title="Four principles behind every module"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 90}>
                <SpotlightCard className="h-full rounded-2xl">
                  <div className="relative h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-indigo-500/60">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                      <Icon name={v.icon} className="h-5 w-5" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-zinc-50">{v.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{v.body}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-t border-zinc-800 bg-zinc-900/40 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Free tool"
                title="Start with your free online presence score"
                subtitle="No sign-up, no card. See how HospiOS reads your reviews and visibility across every channel — then run the full platform."
              />
            </Reveal>
            <div className="mt-10 text-center">
              <Link
                href="/#check-score"
                className="btn-shine inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Check a property now
                <Icon name="star" className="h-4 w-4 text-amber-400" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
