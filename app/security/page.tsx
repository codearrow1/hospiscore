import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import SectionHeading from "@/components/marketing/SectionHeading";
import SpotlightCard from "@/components/marketing/SpotlightCard";
import TiltCard from "@/components/marketing/TiltCard";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import { SITE_NAME, SITE_URL, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security & Compliance",
  description:
    "HospiOS protects your property's data with strong controls: encryption in transit and at rest, role-based access, activity logging, backups, and data-residency options.",
  alternates: { canonical: "/security" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Security & Compliance · HospiOS",
    description:
      "Strong security, out of the box — encryption, role-based access, activity logging and data-residency options.",
    images: [{ url: ogImage("Security & Compliance"), width: 1200, height: 630 }],
  },
};

const PILLARS: { icon: IconName; title: string; body: string; bullets: string[] }[] = [
  {
    icon: "shield",
    title: "Encryption & isolation",
    body: "Your data is encrypted everywhere and isolated from every other property.",
    bullets: [
      "AES-256 at rest, TLS 1.3 in transit",
      "Per-property logical isolation",
      "Encrypted backups with point-in-time restore",
    ],
  },
  {
    icon: "key",
    title: "Access control",
    body: "Every user gets exactly the access they need — no more, no less.",
    bullets: [
      "Role-based access control across staff roles",
      "Two-factor authentication available",
      "Session and API-key management",
    ],
  },
  {
    icon: "trend",
    title: "Activity logging",
    body: "Key actions are logged, reviewable, and attributable to a user.",
    bullets: [
      "Activity logs on important changes",
      "Login and session history",
      "Admin review dashboard",
    ],
  },
  {
    icon: "box",
    title: "Reliability & uptime",
    body: "Hospitality never sleeps, and neither does our platform.",
    bullets: [
      "High-availability cloud architecture",
      "Automated monitoring with status alerts",
      "Planned maintenance outside peak hours",
    ],
  },
  {
    icon: "globe",
    title: "Data residency",
    body: "Choose where your property's data lives.",
    bullets: [
      "EU and US data residency options",
      "Local legal-entity processing where required",
      "Full export and deletion on request",
    ],
  },
  {
    icon: "users",
    title: "Secure by design",
    body: "Security is part of how we build, not an afterthought.",
    bullets: [
      "Continuous dependency and vulnerability scanning",
      "Security review before every release",
      "A channel to report security concerns",
    ],
  },
];

const COMMITMENTS = [
  { name: "Encryption everywhere", detail: "AES-256 at rest and TLS 1.3 in transit for all property data." },
  { name: "Role-based access", detail: "Fine-grained roles so every user only sees what they need." },
  { name: "GDPR-aligned processing", detail: "You stay the controller of guest data; we act as your processor." },
  { name: "Data residency options", detail: "Choose EU or US data residency for your property's data." },
  { name: "Activity logging", detail: "Login and change logs so you can always review what happened." },
  { name: "Backups & recovery", detail: "Automated backups with point-in-time restore." },
];

export default function SecurityPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "HospiOS Security & Compliance",
          url: `${SITE_URL}/security`,
          about: {
            "@type": "Organization",
            name: SITE_NAME,
          },
        }}
      />
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Trust & Security"
          title={
            <>
              Enterprise security, <span className="text-gradient">out of the box</span>
            </>
          }
          subtitle="Your guests' data is the most sensitive thing you hold. We build HospiOS so you never have to think about it — encryption, access control, activity logging, backups and data residency, handled."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Security</span>
            </nav>
          }
        >
          <Link
            href="/contact"
            className="btn-shine btn-arrow inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Talk to our security team
          </Link>
        </PageHero>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="How we protect you"
            title="Six pillars of the HospiOS security model"
            subtitle="Controls that are independently audited and always on — not a checkbox for a sales deck."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={(i % 3) * 90}>
                <TiltCard className="h-full rounded-3xl">
                  <SpotlightCard className="h-full rounded-3xl">
                    <div className="flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-7">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-950/50 text-emerald-300">
                        <Icon name={p.icon} className="h-5 w-5" />
                      </div>
                      <h2 className="mt-4 text-lg font-bold text-zinc-50">{p.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
                      <ul className="mt-4 flex flex-col gap-2">
                        {p.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-sm text-zinc-300">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </SpotlightCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-800/60 bg-zinc-900/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
<SectionHeading
            eyebrow="Trust"
            title="Security commitments & practices"
            subtitle="Plain-language security practices you can share with your procurement team."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMMITMENTS.map((c, i) => (
                <Reveal key={c.name} delay={(i % 3) * 80}>
                  <div className="glow-border flex h-full flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                    <span className="inline-flex items-center gap-2 text-base font-semibold text-zinc-50">
                      <span className="pulse-dot" aria-hidden="true" />
                      {c.name}
                    </span>
                    <p className="text-sm leading-relaxed text-zinc-400">{c.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal from="left">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                  You stay in control of guest data
                </h2>
                <p className="mt-4 leading-relaxed text-zinc-400">
                  Your property is the controller of guest data; HospiOS is the
                  processor acting on your instructions. That means export,
                  correction and deletion on demand — plus support when your
                  guests exercise their data rights.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/privacy" className="btn-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400">
                    Privacy policy
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </Link>
                  <Link href="/terms" className="btn-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400">
                    Terms of service
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </Link>
                </div>
              </div>
            </Reveal>
            <Reveal from="right" delay={120}>
              <div className="glow-border rounded-3xl border border-emerald-900 bg-emerald-950/30 p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900/50 text-emerald-300">
                    <Icon name="shield" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-50">Security questionnaire?</p>
                    <p className="text-xs text-zinc-400">Our team responds in under two business days.</p>
                  </div>
                </div>
                <Link
                  href="/contact"
                  className="btn-shine mt-6 inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  Request a copy
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
