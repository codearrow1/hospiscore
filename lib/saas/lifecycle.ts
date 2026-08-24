/**
 * Subscription lifecycle automation (M-06).
 *
 * Time-based status transitions that previously only happened when an admin
 * remembered to click:
 *   trial                    → expired   (trial window over)
 *   active                   → past_due  (period ended, unpaid, grace elapsed)
 *   past_due | grace         → suspended (delinquency window exhausted)
 *
 * `classifyLifecycle` is pure so the windows are unit-testable; the cron route
 * applies transitions through the guarded state machine.
 */
import type { SubscriptionStatus } from "./subscriptions";

/** Grace after period end before an active sub is marked past_due: 3 days. */
export const PAST_DUE_AFTER_MS = 3 * 86_400_000;
/** Delinquency window before past_due/grace subs are suspended: 10 days. */
export const SUSPEND_AFTER_MS = 10 * 86_400_000;
/** Small skew allowance after trialEndsAt before expiry: 24h. */
export const TRIAL_EXPIRY_SKEW_MS = 86_400_000;

const LIFECYCLE_STATUSES = ["active", "past_due", "grace", "suspended", "trial", "cancelled", "expired", "paused"] as const;

function asStatus(v: string): SubscriptionStatus | null {
  return (LIFECYCLE_STATUSES as readonly string[]).includes(v) ? (v as SubscriptionStatus) : null;
}

export function classifyLifecycle(
  sub: {
    status: string;
    currentPeriodEnd: Date | null;
    trialEndsAt?: Date | null;
  },
  nowMs: number = Date.now(),
): SubscriptionStatus | null {
  const status = asStatus(sub.status);
  if (!status) return null;

  if (status === "trial") {
    const end = sub.trialEndsAt ?? null;
    if (end && end.getTime() + TRIAL_EXPIRY_SKEW_MS < nowMs) return "expired";
    return null;
  }

  const periodEnd = sub.currentPeriodEnd?.getTime();
  if (periodEnd == null || !Number.isFinite(periodEnd)) return null;

  if (status === "active" && periodEnd + PAST_DUE_AFTER_MS < nowMs) return "past_due";
  if ((status === "past_due" || status === "grace") && periodEnd + SUSPEND_AFTER_MS < nowMs) return "suspended";
  return null;
}
