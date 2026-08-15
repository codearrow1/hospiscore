import Link from "next/link";
import Icon from "@/components/marketing/icons";
import { SOLUTIONS } from "@/lib/solutions";

/**
 * "Designed for every style of stay" — solutions strip shown on the home page.
 */
export default function SolutionsStrip() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SOLUTIONS.map((s) => (
        <Link
          key={s.slug}
          href={`/solutions/${s.slug}`}
          className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:-translate-y-1 hover:border-indigo-500/60 hover:bg-zinc-900"
        >
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300 transition group-hover:bg-indigo-500/20">
            <Icon name={s.icon} className="h-5 w-5" />
          </span>
          <h3 className="font-semibold text-zinc-50">{s.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.tagline}</p>
        </Link>
      ))}
    </div>
  );
}
