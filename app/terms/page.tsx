import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import { SITE_NAME, ogImage } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of HospiOS and its services — clearly written, without surprises.",
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Terms of Service · HospiOS",
    description:
      "The terms that govern your use of HospiOS and its services.",
    images: [{ url: ogImage("Terms of Service"), width: 1200, height: 630 }],
  },
};

const SECTIONS = [
  {
    heading: "1. Agreement",
    body: "These Terms of Service (\"Terms\") govern your access to and use of the HospiOS platform, website, and related services (the \"Service\"). By creating an account or using the Service, you agree to these Terms. If you use the Service on behalf of a company or property, you represent that you have authority to bind that entity.",
  },
  {
    heading: "2. Your account",
    body: "You are responsible for safeguarding your credentials and for all activity under your account. You must provide accurate information and keep it current. Notify us immediately of any unauthorized access. Accounts may be used only by the property or organization that signed up.",
    list: [
      "You must be at least 18 years old to use the Service.",
      "You are responsible for the conduct of your staff and the accuracy of data you enter.",
      "Role-based access lets you control what each team member can see and do.",
    ],
  },
  {
    heading: "3. Subscriptions & billing",
    body: "Paid plans are billed in advance on a monthly or annual basis per property. Prices are shown on our pricing page and may change with notice. You can cancel at any time; access continues until the end of the paid period. No refunds are given for partial periods except where required by law.",
  },
  {
    heading: "4. Your data",
    body: "You retain ownership of the data you enter into the Service. You grant us the right to process that data to provide, maintain, and improve the Service, as described in our Privacy Policy. We never sell your data, and we never use it to market to your guests.",
  },
  {
    heading: "5. Acceptable use",
    list: [
      "You must not resell, sublicense, or provide the Service to third parties except through official multi-property plans.",
      "You must not attempt to break, probe, or circumvent the security of the Service.",
      "You must not use the Service to send unsolicited messages or process unlawful content.",
      "You must comply with all applicable laws, including data-protection and anti-spam rules.",
    ],
  },
  {
    heading: "6. Service availability",
    body: "We aim for 99.9% uptime and provide status communication for planned maintenance. The Service may be unavailable for scheduled maintenance, which we schedule outside peak property hours where possible. We are not liable for unavailability caused by factors outside our reasonable control.",
  },
  {
    heading: "7. Intellectual property",
    body: "HospiOS and its software, design, trademarks, and content are owned by us or our licensors. You may not copy, modify, distribute, or create derivative works of the Service or its branding except as permitted in writing.",
  },
  {
    heading: "8. Limitation of liability",
    body: "To the maximum extent permitted by law, HospiOS is not liable for indirect, incidental, special, or consequential damages, or for lost revenue, profits, or data, arising from your use of the Service. Our total liability for any claim is limited to the amounts you paid us in the twelve months preceding the claim.",
  },
  {
    heading: "9. Termination",
    body: "You may cancel your subscription at any time. We may suspend or terminate access for breach of these Terms, fraudulent activity, or where required by law. On termination, you can export your data within 30 days; after that period we may delete data in accordance with our retention policy.",
  },
  {
    heading: "10. Changes to these Terms",
    body: "We may update these Terms from time to time. Material changes will be announced in advance via email or an in-product notice. Continued use of the Service after changes take effect constitutes acceptance.",
  },
  {
    heading: "11. Contact",
    body: "Questions about these Terms? Email us at legal@hospios.dev or reach out through the contact page. These Terms were last updated on 1 August 2026.",
  },
];

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Legal"
          title={
            <>
              Terms of <span className="text-gradient">Service</span>
            </>
          }
          subtitle="The plain-language terms that govern your use of HospiOS. We wrote them to be clear, fair, and boring — the way legal documents should be."
          top={
            <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
              <Link href="/" className="link-underline hover:text-indigo-400">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-zinc-300">Terms</span>
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
              <h2 className="text-xl font-bold text-zinc-50">Have a question?</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Our team is happy to clarify anything in these terms.
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
