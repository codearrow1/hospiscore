const TESTIMONIALS = [
  {
    quote:
      "Front desk, housekeeping, POS and finance used to live in four different tools. HospiOS puts everything in one place — no more re-keying the same stay into three systems.",
    role: "Regional operations · 14-property group",
  },
  {
    quote:
      "Rates and inventory no longer drift across channels. The two-way sync means we check distribution once a day instead of every hour.",
    role: "General manager · boutique hotel",
  },
  {
    quote:
      "We run a small property with a tiny team. Guest self-service and AI reply drafts let us deliver quick, personal service without adding headcount.",
    role: "Owner · 3-villa property",
  },
];

export default function Testimonials() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {TESTIMONIALS.map((t, i) => (
        <figure
          key={t.role}
          className="glow-border flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 10.5a4 4 0 1 1 4-4M8 10.5A4.5 4.5 0 0 0 3.5 15V19a1 1 0 0 0 1 1H8v-3m0-6.5V18m8-7.5a4 4 0 1 0-4-4m4 4A4.5 4.5 0 0 1 20.5 15V19a1 1 0 0 1-1 1H16v-3m0-6.5V18" />
            </svg>
          </div>
          <blockquote className="flex-1 text-sm leading-relaxed text-zinc-300">
            “{t.quote}”
          </blockquote>
          <figcaption className="mt-5">
            <p className="text-sm font-semibold text-zinc-100">{t.role}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}