import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "danger-solid";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:border-indigo-600",
  secondary:
    "border border-line bg-surface text-foreground shadow-sm hover:bg-surface-subtle",
  ghost: "border border-transparent text-ink-secondary hover:bg-surface-subtle hover:text-foreground",
  destructive:
    "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
  "danger-solid": "border border-transparent bg-red-600 text-white shadow-sm hover:bg-red-500",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1 rounded-lg px-2.5 py-1.5 text-xs",
  md: "min-h-11 gap-1.5 rounded-xl px-4 py-2.5 text-sm",
  lg: "min-h-12 gap-2 rounded-xl px-5 py-3 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  const base =
    "inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  return `${base} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading && <Spinner />}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  children,
  className = "",
  external,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={buttonClass(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
