import Header from "@/components/Header";
import Footer from "@/components/marketing/Footer";
import BookDemoForm from "@/components/BookDemoForm";
import Reveal from "@/components/marketing/Reveal";

const PERKS = [
  {
    title: "Live, on your properties",
    body: "We set up your property on HospiOS in the session — front desk, housekeeping, POS, and your free online presence score. Not a generic slideshow.",
  },
  {
    title: "30 minutes, no prep",
    body: "Bring your property names and a couple of screenshots if you like. You'll leave with a concrete plan either way.",
  },
  {
    title: "Built for your scale",
    body: "Boutique single-site, a resort, or a 200-property group — we'll show you exactly which of the 23 modules matter for you.",
  },
];

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main id="main" className="flex-1 bg-zinc-50/60 dark:bg-zinc-900/40">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <Reveal from="left">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-500">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-indigo-500" aria-hidden="true" />
                Book a demo
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
                See <span className="text-gradient">HospiOS</span> run your property
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
                A focused 30-minute walkthrough of the all-in-one hotel PMS — front
                desk, reservations, housekeeping, POS, finance, channel manager,
                and AI automation — on your own properties.
              </p>

              <ul className="mt-8 flex flex-col gap-6">
                {PERKS.map((p) => (
                  <li key={p.title} className="group flex gap-4">
                    <span
                      aria-hidden="true"
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white transition duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/30"
                    >
                      ✓
                    </span>
                    <div>
                      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{p.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{p.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={120} from="right">
            <div className="glow-border rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
              <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Book your walkthrough
              </h2>
              <BookDemoForm />
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
