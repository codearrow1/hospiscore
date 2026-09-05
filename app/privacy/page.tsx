import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How HospiOS handles your data and your guests' data — what we collect, why, and how we protect it.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Privacy Policy · HospiOS",
    description:
      "How HospiOS handles your data and your guests' data.",
    images: [{ url: ogImage("Privacy Policy"), width: 1200, height: 630 }],
  },
};

const SECTIONS = [
  {
    heading: "1. What we collect",
    body: "We collect the information you provide when you create an account, book a demo, or contact us — your name, business email, property details, and payment information. When you use the Service, we collect the operational data you enter, including reservations, guest profiles, and configuration.",
  },
  {
    heading: "2. How we use it",
    body: "We use your data to provide and operate the Service, support you, secure the platform, and improve our products. We process guest data only on your behalf — you are the controller, we are the processor.",
    list: [
      "Operational data (bookings, folios, housekeeping) is used solely to run your property.",
      "We use aggregated, anonymized insights to improve pricing and forecasting features.",
      "We never use your guest data for our own marketing, and we never sell data.",
    ],
  },
  {
    heading: "3. Guest data",
    body: "Guest profiles, documents, and stay history belong to your property and your guests. We handle this data under your instructions and in line with data-protection law. We retain it only as long as your account is active or as required by law, and you can export or delete it at any time.",
  },
  {
    heading: "4. Sharing",
    list: [
      "We share data only with sub-processors needed to run the service (hosting, email delivery, payments).",
      "We share data with OTAs and partners only when you connect them through integrations.",
      "We disclose data to authorities only where legally required, with notification to you where permitted.",
    ],
  },
  {
    heading: "5. Security",
    body: "We protect data with encryption in transit and at rest, role-based access controls, two-factor authentication, activity logs, and automated backups. Our security architecture is documented on the security page.",
  },
  {
    heading: "6. Retention",
    body: "We retain your account data while your account is active. If you cancel, you can export your data for 30 days. After that, we delete or anonymize personal data in line with our retention policy, except where we are required to keep records by law.",
  },
  {
    heading: "7. Your rights",
    body: "You can access, correct, export, or delete the data you control at any time from your account settings or by contacting us. Guests whose data your property processes can exercise their rights with you as the controller — we support you in honoring those requests.",
  },
  {
    heading: "8. Cookies",
    body: "We use essential cookies to run the Service and, where you consent, analytics cookies to understand how the site is used. You can control cookies through your browser. We do not use third-party advertising cookies.",
  },
  {
    heading: "9. Changes",
    body: "We will notify you of material changes to this policy by email or in-product notice. The date of the latest update is shown below.",
  },
  {
    heading: "10. Contact & DPO",
    body: "For privacy questions or data requests, email privacy@hospios.dev or write to HospiOS, Privacy Team. You can also reach out through the contact page. This policy was last updated on 1 August 2026.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Legal"
          title={
            <>
              Privacy <span className="text-gradient">Policy</span>
            </>
          }
          subtitle="What we collect, why we collect it, and how we keep it safe. We treat your data — and your guests' data — with the care it deserves."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Privacy</span>
            </nav>
          }
        />

        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-10">
            {SECTIONS.map((s, i) => (
              <Reveal key={s.heading} delay={i % 2 ? 60 : 0}>
                <section>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-50">
                    {s.heading}
                  </h2>
                  {s.body && (
                    <p className="mt-3 text-base leading-relaxed text-zinc-400">{s.body}</p>
                  )}
                  {s.list && (
                    <ul className="mt-4 flex flex-col gap-3">
                      {s.list.map((li) => (
                        <li key={li} className="flex items-start gap-3">
                          <span className="mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                          <span className="text-base leading-relaxed text-zinc-300">{li}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </Reveal>
            ))}
          </div>

          <Reveal delay={80}>
            <div className="glow-border mt-14 rounded-3xl border border-indigo-900 bg-indigo-950/40 p-8 text-center">
              <h2 className="text-xl font-bold text-zinc-50">Questions about privacy?</h2>
              <p className="mt-2 text-sm text-zinc-400">
                We answer every privacy question personally.
              </p>
              <Link
                href="/contact"
                className="btn-shine btn-arrow mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Contact us
              </Link>
            </div>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
