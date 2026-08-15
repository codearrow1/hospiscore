const TESTIMONIALS = [
  {
    quote:
      "Front desk, housekeeping, POS and finance used to live in four different tools. HospiOS put everything in one place — my team stopped re-keying data the week we switched.",
    name: "Marta Alvarez",
    role: "Regional Director · 14-property portfolio",
    initials: "MA",
    color: "bg-emerald-500",
  },
  {
    quote:
      "The channel manager paid for itself in a month. Rates and inventory never drift anymore, and overbooking has gone to zero.",
    name: "James Okafor",
    role: "GM · The Royal Sandpiper",
    initials: "JO",
    color: "bg-indigo-500",
  },
  {
    quote:
      "We run three villas with a tiny team. The guest self-service portal and AI reply drafts let us deliver five-star service without adding headcount.",
    name: "Sofia Lindqvist",
    role: "Owner · Fjordside Cabins",
    initials: "SL",
    color: "bg-violet-500",
  },
];

export default function Testimonials() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {TESTIMONIALS.map((t, i) => (
        <figure
          key={t.name}
          className="glow-border flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="mb-3 flex gap-0.5 text-amber-400" aria-hidden="true">
            {"★★★★★".split("").map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
          <blockquote className="flex-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            “{t.quote}”
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${t.color} text-sm font-bold text-white`}>
              {t.initials}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.role}</p>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
