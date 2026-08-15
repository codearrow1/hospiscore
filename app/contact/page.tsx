import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import SectionHeading from "@/components/marketing/SectionHeading";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import ContactForm from "@/components/ContactForm";
import Icon from "@/components/marketing/icons";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to the HospiOS team about demos, pricing, support, or partnerships.",
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1">
        <PageHero
          eyebrow="Contact"
          title={
            <>
              Let&apos;s talk about <span className="text-gradient">your property</span>
            </>
          }
          subtitle={
            <>
              Questions about demos, pricing, or integrations — send us a note
              and we&apos;ll get back within one business day.
            </>
          }
        />

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
            <Reveal>
              <div>
                <SectionHeading
                  eyebrow="Get in touch"
                  title="Prefer to talk directly?"
                  align="left"
                />
              <ul className="mt-8 flex flex-col gap-4">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <Icon name="calendar" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium text-zinc-100">Book a live demo</p>
                    <p className="text-sm text-zinc-400">
                      The fastest way to see HospiOS on your property —{" "}
                      <Link href="/demo" className="text-indigo-400 hover:text-indigo-300">book here</Link>.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <Icon name="coins" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium text-zinc-100">Pricing & plans</p>
                    <p className="text-sm text-zinc-400">
                      See per-room pricing and use the live calculator on our{" "}
                      <Link href="/pricing" className="text-indigo-400 hover:text-indigo-300">pricing page</Link>.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <Icon name="chat" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium text-zinc-100">Existing customers</p>
                    <p className="text-sm text-zinc-400">
                      Support is in-app and by email — you&apos;ll find your account
                      options under <span className="text-zinc-300">Sign in</span>.
                    </p>
                  </div>
                </li>
              </ul>

              <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
                <p className="text-sm font-semibold text-zinc-100">First, try the free score</p>
                <p className="mt-1 text-sm text-zinc-400">
                  See how HospiOS reads your online presence before you commit to anything.
                </p>
                <Link
                  href="/#check-score"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-indigo-400 hover:text-indigo-300"
                >
                  Check a property now
                  <Icon name="star" className="h-4 w-4 text-amber-400" />
                </Link>
              </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
                <ContactForm />
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
