import type { ReactNode } from "react";
import Reveal from "./Reveal";

/**
 * Shared dark page hero: animated grid + glow orbs behind an eyebrow, title,
 * optional subtitle, optional `top` slot (breadcrumbs / badges / icon), and a
 * CTA row (children). Every marketing subpage uses it so the hero treatment
 * stays consistent site-wide.
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  top,
  children,
  align = "center",
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional leading block (breadcrumbs, badges, icon) above the eyebrow. */
  top?: ReactNode;
  /** CTA row, rendered under the subtitle. */
  children?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const alignCls = align === "center" ? "text-center" : "text-left";

  return (
    <section
      className={`relative overflow-hidden border-b border-zinc-800 bg-zinc-950 ${className}`}
    >
      {/* Animated backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="bg-grid absolute inset-0" />
        <div className="animate-glow absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-900/40 via-violet-900/25 to-transparent blur-3xl" />
        <div className="animate-float-slow absolute -right-24 top-24 h-64 w-64 rounded-full bg-indigo-900/20 blur-3xl" />
        <div className="animate-float absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-violet-900/20 blur-3xl" />
        <div className="animate-spin-slow absolute -right-16 -top-16 h-64 w-64 rounded-full border border-indigo-500/10" />
        <div className="animate-spin-slower absolute -bottom-24 left-10 h-80 w-80 rounded-full border border-dashed border-violet-500/10" />
      </div>

      <div className={`relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20 ${alignCls}`}>
        {top && (
          <Reveal>
            <div className={align === "center" ? "flex justify-center" : ""}>{top}</div>
          </Reveal>
        )}
        <Reveal delay={60}>
          {top && <div className="h-6" aria-hidden="true" />}
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            {align === "left" && (
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-indigo-400" aria-hidden="true" />
            )}
            {eyebrow}
            {align === "center" && (
              <span className="h-px w-6 bg-gradient-to-r from-indigo-400 to-transparent" aria-hidden="true" />
            )}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <div
              className={`mt-5 text-base leading-relaxed text-zinc-400 ${
                align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"
              }`}
            >
              {subtitle}
            </div>
          )}
        </Reveal>
        {children && (
          <Reveal delay={140}>
            <div
              className={`mt-8 flex flex-wrap items-center gap-4 ${
                align === "center" ? "justify-center" : ""
              }`}
            >
              {children}
            </div>
          </Reveal>
        )}
      </div>

      {align === "center" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 animate-float lg:block"
        >
          <svg className="h-5 w-5 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      )}
    </section>
  );
}
