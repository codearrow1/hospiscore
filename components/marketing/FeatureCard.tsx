import type { ReactNode } from "react";

/**
 * Marketing feature card with an inline icon (server component).
 */
export default function FeatureCard({
  icon,
  title,
  body,
  accent = "indigo",
}: {
  icon: ReactNode;
  title: string;
  body: string;
  accent?: "indigo" | "violet" | "emerald" | "amber" | "rose" | "sky";
}) {
  const accents: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${accents[accent]} transition duration-300 group-hover:scale-110 group-hover:rotate-6`}
      >
        {icon}
      </div>
      <h3 className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}