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
 *
 * Settings (via Settings Resolver):
 * - past_due_grace_days: Grace period before past due [default: 3]
 * - suspend_after_days: Days before suspension [default: 10]
 */
import type { SubscriptionStatus } from "./subscriptions";
import { resolveSetting } from "@/lib/settings/resolver";

/** Default grace period (used as fallback if setting unavailable) */
export const DEFAULT_PAST_DUE_AFTER_MS = 3 * 86_400_000;
/** Default delinquency window (used as fallback if setting unavailable) */
export const DEFAULT_SUSPEND_AFTER_MS = 10 * 86_400_000;
/** Backward-compatible constants */
export const PAST_DUE_AFTER_MS = DEFAULT_PAST_DUE_AFTER_MS;
export const SUSPEND_AFTER_MS = DEFAULT_SUSPEND_AFTER_MS;
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
  pastDueAfterMs: number = DEFAULT_PAST_DUE_AFTER_MS,
  suspendAfterMs: number = DEFAULT_SUSPEND_AFTER_MS,
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

  if (status === "active" && periodEnd + pastDueAfterMs < nowMs) return "past_due";
  if ((status === "past_due" || status === "grace") && periodEnd + suspendAfterMs < nowMs) return "suspended";
  return null;
}

/**
 * Async version that resolves settings from the database.
 * Use this in production code; keep classifyLifecycle pure for tests.
 */
export async function classifyLifecycleAsync(
  sub: {
    status: string;
    currentPeriodEnd: Date | null;
    trialEndsAt?: Date | null;
  },
  nowMs: number = Date.now(),
): Promise<SubscriptionStatus | null> {
  let pastDueAfterMs = DEFAULT_PAST_DUE_AFTER_MS;
  let suspendAfterMs = DEFAULT_SUSPEND_AFTER_MS;

  try {
    const [graceDays, suspendDays] = await Promise.all([
      resolveSetting<number>("past_due_grace_days"),
      resolveSetting<number>("suspend_after_days"),
    ]);
    pastDueAfterMs = graceDays * 86_400_000;
    suspendAfterMs = suspendDays * 86_400_000;
  } catch {
    // Use defaults if settings unavailable
  }

  return classifyLifecycle(sub, nowMs, pastDueAfterMs, suspendAfterMs);
}
