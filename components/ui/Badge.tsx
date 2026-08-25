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

/**
 * Distinct glyph per tone so status is conveyed by shape + text, never by
 * color alone (WCAG 1.4.1). Rendered inside StatusBadge.
 */
function ToneIcon({ tone }: { tone: Tone }) {
  const paths: Record<Tone, ReactNode> = {
    neutral: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
    brand: <path d="M5 12h14" strokeWidth={2.5} />,
    success: <path d="M20 6 9 17l-5-5" strokeWidth={2.5} />,
    warning: <path d="M12 7v6m0 3h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
    danger: <path d="m6 6 12 12M18 6 6 18" strokeWidth={2.5} />,
    info: <path d="M12 11v5m0-8h.01" />,
    accent: <path d="M12 4v16m-8-8h16" strokeWidth={2} transform="rotate(45 12 12)" />,
  };
  return (
    <svg aria-hidden="true" className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      {paths[tone]}
    </svg>
  );
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
      <ToneIcon tone={meta.tone} />
      {meta.label}
    </span>
  );
}
