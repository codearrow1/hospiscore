import Link from "next/link";
import { MODULE_CATEGORIES, PMS_MODULES } from "@/lib/modules";
import Icon from "@/components/marketing/icons";

/**
 * Grouped marketing view of the 23 PMS modules.
 * `detailed` renders bullet lists (used on /platform); otherwise compact cards.
 */
export default function ModuleGrid({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className="flex flex-col gap-14">
      {MODULE_CATEGORIES.map((cat) => {
        const modules = PMS_MODULES.filter((m) => m.category === cat.id);
        return (
          <div key={cat.id}>
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                <Icon name={cat.icon} className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {cat.label}
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {modules.length}
                  </span>
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{cat.blurb}</p>
              </div>
            </div>

            <div className={`grid gap-4 ${detailed ? "md:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
              {modules.map((m) => (
                <div
                  key={m.id}
                  id={m.id}
                  className="glow-border group scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                >
                  <Link href={`/platform#${m.id}`}>
                    <h4 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                      <Icon name={cat.icon} className="h-4 w-4 text-indigo-500 transition duration-300 group-hover:scale-125 group-hover:text-indigo-400" />
                      {m.name}
                    </h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {m.tagline}
                    </p>
                  </Link>
                  {detailed && (
                    <ul className="mt-3 flex flex-col gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      {m.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
