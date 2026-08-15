const CHANNELS = [
  { title: "Multi-geography support", body: "Time-zone aware support across the regions where your teams operate." },
  { title: "Live chat & in-app guidance", body: "Talk to a human in-app, over email, or on scheduled phone calls." },
  { title: "Self-service portal", body: "Requests, documents, onboarding tasks, and account visibility in one place." },
  { title: "Clear SLAs", body: "Onboarding, migration, pricing, and billing expectations stay aligned." },
  { title: "Priority routing", body: "Callback and priority escalation when your property hits an urgent issue." },
  { title: "Secure cloud hosting", body: "Redundancy, backups, and recovery planning built for continuity." },
];

export default function Support() {
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-center">
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Dedicated support for every shift
        </h3>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          From your first setup call to a 3 a.m. payment issue, our team is
          reachable and accountable. Every plan includes onboarding help and a
          structured launch checklist — enterprise customers get a dedicated
          success manager.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {CHANNELS.slice(0, 3).map((c) => (
            <li key={c.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" /></svg>
              </span>
              <div>
                <p className="font-medium text-zinc-100">{c.title}</p>
                <p className="text-sm text-zinc-400">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Support you can rely on
        </p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <li key={c.title} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-zinc-950/80">
              <p className="font-medium text-zinc-100">{c.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{c.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
