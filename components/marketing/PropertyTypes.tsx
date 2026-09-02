import Link from "next/link";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";
import { PMS_MODULES } from "@/lib/modules";
import { SOLUTIONS } from "@/lib/solutions";

/**
 * Property Types — a visual, imagery-free showcase of the real solutions
 * catalogue (lib/solutions.ts). Each card links to its /solutions/[slug] page.
 * No invented proof: icons + real taglines + representative module chips.
 */

const ACCENTS = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600",
  "from-violet-500 to-indigo-600",
  "from-teal-500 to-emerald-600",
];

export default function PropertyTypes() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SOLUTIONS.map((s, i) => {
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <Link
            key={s.slug}
            href={`/solutions/${s.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 transition duration-300 hover:-translate-y-1 hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-950/40"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
            />
            <span
              aria-hidden="true"
              className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg transition duration-300 group-hover:scale-110`}
            >
              <Icon name={s.icon as IconName} className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-lg font-bold tracking-tight text-zinc-50">{s.name}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{s.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {s.moduleIds.slice(0, 3).map((id) => {
                const mod = PMS_MODULES.find((m) => m.id === id);
                return mod ? (
                  <span
                    key={id}
                    className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400"
                  >
                    {mod.name}
                  </span>
                ) : null;
              })}
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-800/70 bg-indigo-950/50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                Explore
                <svg className="h-3 w-3 transition group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.94l-4.72-4.72a.75.75 0 1 1 1.06-1.06l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06l4.72-4.72H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}