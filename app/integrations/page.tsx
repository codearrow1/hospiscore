import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import SectionHeading from "@/components/marketing/SectionHeading";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import Icon from "@/components/marketing/icons";
import { INTEGRATION_GROUPS, TOTAL_INTEGRATIONS } from "@/lib/integrations";

export const metadata: Metadata = {
  title: "Integrations",
  description: `Connect HospiOS to ${TOTAL_INTEGRATIONS}+ tools — OTAs, payment gateways, communication, calendars, hardware, and accounting — through one API-first platform.`,
};

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Integrations"
          title={
            <>
              Your stack, <span className="text-gradient">connected</span>
            </>
          }
          subtitle={
            <>
              {TOTAL_INTEGRATIONS}+ integrations across OTAs, payments,
              communication, calendars, hardware, and accounting — plus a public
              REST API and webhooks for everything else.
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
          <div className="grid gap-8 lg:grid-cols-2">
            {INTEGRATION_GROUPS.map((g, gi) => (
              <Reveal key={g.id} delay={(gi % 2) * 100}>
                <div className="h-full rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-indigo-500/50 hover:bg-zinc-900/80">
                  <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                    {g.label}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">{g.blurb}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {g.items.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-zinc-800 bg-zinc-950 px-3.5 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-indigo-500/40 hover:text-zinc-50"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="glow-border mt-12 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8">
              <SectionHeading
                eyebrow="API-first"
                title="Build anything on HospiOS"
                subtitle="Every module is backed by a public REST API with webhooks, so your developers can extend the platform however you need."
              />
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {["REST API", "Webhooks", "API keys & scopes", "Sandbox environment", "Rate limits & docs"].map((t) => (
                  <span key={t} className="rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-indigo-500/40 hover:text-zinc-50">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
