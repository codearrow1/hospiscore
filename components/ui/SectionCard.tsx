import Link from "next/link";
import type { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  accent = "text-zinc-900 dark:text-zinc-50",
  icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </>
  );
  const cls =
    "block rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-700";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls.replace(" transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-700", "")}>{inner}</div>;
}
