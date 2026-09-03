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
    indigo: "bg-indigo-500/15 text-indigo-300",
    violet: "bg-violet-500/15 text-violet-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    rose: "bg-rose-500/15 text-rose-300",
    sky: "bg-sky-500/15 text-sky-300",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition duration-300 hover:-translate-y-1 hover:border-zinc-600 hover:shadow-xl hover:shadow-indigo-950/40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${accents[accent]} transition duration-300 group-hover:scale-110 group-hover:rotate-6`}
      >
        {icon}
      </div>
      <h3 className="mb-1.5 font-semibold text-zinc-100">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}