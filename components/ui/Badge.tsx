import type { ReactNode } from "react";
import { statusMeta, type Tone } from "@/lib/statusMap";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  brand: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
  accent: "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
};

/** Small dot reinforcing the tone so status is never color-only (a11y). */
function ToneDot({ tone }: { tone: Tone }) {
  const bg: Record<Tone, string> = {
    neutral: "bg-zinc-400",
    brand: "bg-indigo-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-sky-500",
    accent: "bg-violet-500",
  };
  return <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${bg[tone]}`} />;
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className || TONE_CLASS.neutral}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  domain,
  status,
  className = "",
}: {
  domain: string;
  status: string | null | undefined;
  className?: string;
}) {
  const meta = statusMeta(domain, status);
  return (
    <span
      title={meta.label}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[meta.tone]} ${className}`}
    >
      <ToneDot tone={meta.tone} />
      {meta.label}
    </span>
  );
}
