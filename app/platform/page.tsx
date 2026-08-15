import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import ModuleGrid from "@/components/marketing/ModuleGrid";
import PageHero from "@/components/marketing/PageHero";
import Icon from "@/components/marketing/icons";
import { TOTAL_MODULES } from "@/lib/modules";

export const metadata: Metadata = {
  title: "Platform & Modules",
  description:
    "All 23 HospiOS PMS modules — operations, guest experience, food & beverage, back-of-house, finance, revenue, and enterprise automation in one platform.",
};

export default function PlatformPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1 bg-zinc-50/60 dark:bg-zinc-900/40">
        <PageHero
          eyebrow="The platform"
          title={
            <>
              <span className="text-gradient">{TOTAL_MODULES} modules</span>. One operating system.
            </>
          }
          subtitle={
            <>
              Every department of your property — from the front desk to the
              kitchen, the laundry to the ledger — runs on one modular platform.
              Turn modules on as you grow, or go live with the full suite from
              day one.
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
          <a
            href="#modules"
            className="glow-border inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
          >
            Explore modules
          </a>
        </PageHero>

        <section id="modules" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <ModuleGrid detailed />
        </section>

        <section className="border-t border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="glow-border flex flex-col items-center justify-between gap-6 rounded-3xl border border-indigo-200 bg-indigo-50 p-8 text-center sm:flex-row sm:text-left dark:border-indigo-900 dark:bg-indigo-950/40">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  Prefer to see it live?
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  We&apos;ll walk through the modules that matter for your property and
                  score your online presence for free.
                </p>
              </div>
              <Link
                href="/demo"
                className="btn-shine btn-arrow inline-flex shrink-0 items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Book a demo
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
