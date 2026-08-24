/**
 * Back-compat facade over the Phase 1 design-system kit (`components/ui`).
 *
 * Every legacy consumer of `@/components/marketing-admin/ui` keeps working
 * unchanged: same export names and prop shapes. Internals now route through
 * the shared kit so tokens, focus management, and status semantics stay
 * consistent product-wide.
 */
import { buttonClass } from "@/components/ui/Button";
import { AccessibleModal } from "@/components/ui/AccessibleModal";
import type { ReactNode } from "react";

export {
  KpiCard,
  SectionCard,
  Badge,
  EmptyState,
  Field,
  inputCls,
  SkeletonLine,
} from "@/components/ui/index";

export const btnPrimary = buttonClass("primary", "md");
export const btnGhost =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-surface-subtle dark:text-zinc-200";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AccessibleModal open={open} onClose={onClose} title={title} wide={wide}>
      {children}
    </AccessibleModal>
  );
}
