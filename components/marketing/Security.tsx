import Icon from "./icons";
import Reveal from "./Reveal";
import Link from "next/link";

/**
 * Security & compliance band (server component): trust badges + brief copy.
 * Static content — no animation beyond the base hover utilities.
 */

const BADGES = [
  "SOC 2 Type II",
  "ISO 27001",
  "GDPR ready",
  "PCI-DSS level 1",
  "99.99% uptime SLA",
  "EU data residency",
];

export default function Security() {
  return (
    <section className="border-t border-zinc-800/60 bg-zinc-900/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal from="left">
            <div>
              <div className="animate-float-slow flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-950/50 text-emerald-300 shadow-lg shadow-emerald-950/30">
                <Icon name="shield" className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                Enterprise security, out of the box
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-zinc-400">
                Your guests&apos; data is the most sensitive thing you hold. HospiOS
                encrypts everything in transit and at rest, audits every action,
                and keeps you compliant so you don&apos;t have to think about it.
              </p>
              <ul className="mt-6 space-y-2.5">
                  {[
                    "AES-256 encryption at rest and TLS 1.3 in transit",
                    "Role-based access with full audit trails",
                    "Automated nightly backups with point-in-time restore",
                    "EU and US data residency options",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/security"
                  className="btn-arrow mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 transition hover:text-indigo-300"
                >
                  Learn more about security
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </div>
          </Reveal>

          <Reveal from="right" delay={120}>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {BADGES.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-300 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-700 hover:text-zinc-100"
                >
                  <span className="pulse-dot" aria-hidden="true" />
                  {badge}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
