/**
 * HospiOS status semantics (Phase 1).
 *
 * Single source of truth mapping every domain lifecycle state to a human label
 * and a semantic tone. All product surfaces must render statuses through
 * `StatusBadge`/`statusMeta` — never ad-hoc colors.
 */

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

type DomainMap = Record<string, StatusMeta>;

function m(label: string, tone: Tone): StatusMeta {
  return { label, tone };
}

export const STATUS_MAP: Record<string, DomainMap> = {
  subscription: {
    trial: m("Trial", "info"),
    trialing: m("Trial", "info"),
    active: m("Active", "success"),
    past_due: m("Past due", "warning"),
    suspended: m("Suspended", "danger"),
    cancelled: m("Cancelled", "neutral"),
    expired: m("Expired", "neutral"),
  },
  invoice: {
    draft: m("Draft", "neutral"),
    open: m("Open", "info"),
    sent: m("Sent", "info"),
    issued: m("Issued", "info"),
    paid: m("Paid", "success"),
    partially_paid: m("Partially paid", "warning"),
    past_due: m("Past due", "danger"),
    overdue: m("Overdue", "danger"),
    void: m("Void", "neutral"),
    voided: m("Void", "neutral"),
    refunded: m("Refunded", "accent"),
  },
  payment: {
    pending: m("Pending", "warning"),
    succeeded: m("Succeeded", "success"),
    failed: m("Failed", "danger"),
    refunded: m("Refunded", "accent"),
  },
  ticket: {
    new: m("New", "info"),
    open: m("Open", "info"),
    in_progress: m("In progress", "warning"),
    pending: m("Pending", "warning"),
    resolved: m("Resolved", "success"),
    closed: m("Closed", "neutral"),
  },
  demo: {
    new: m("New", "info"),
    confirmed: m("Confirmed", "brand"),
    reschedule_requested: m("Reschedule requested", "warning"),
    completed: m("Completed", "success"),
    no_show: m("No-show", "danger"),
    cancelled: m("Cancelled", "neutral"),
    converted: m("Converted", "accent"),
  },
  sla: {
    breached: m("SLA breached", "danger"),
    in_sla: m("In SLA", "success"),
    ok: m("In SLA", "success"),
  },
  dunning: {
    active: m("Collecting", "warning"),
    recovered: m("Recovered", "success"),
    suspended: m("Paused", "neutral"),
    given_up: m("Given up", "danger"),
    cancelled: m("Cancelled", "neutral"),
    failed: m("Failed", "danger"),
  },
  payout: {
    pending: m("Pending", "warning"),
    processing: m("Processing", "info"),
    paid: m("Paid", "success"),
    completed: m("Paid", "success"),
    failed: m("Failed", "danger"),
    cancelled: m("Cancelled", "neutral"),
  },
  commission: {
    pending: m("Pending", "warning"),
    eligible: m("Eligible", "info"),
    payable: m("Payable", "brand"),
    approved: m("Approved", "info"),
    partially_consumed: m("Partially paid", "warning"),
    consumed: m("Paid out", "success"),
    paid: m("Paid out", "success"),
    reversed: m("Reversed", "danger"),
  },
  affiliate: {
    applied: m("Applied", "info"),
    approved: m("Approved", "accent"),
    active: m("Active", "success"),
    suspended: m("Suspended", "danger"),
    rejected: m("Rejected", "neutral"),
    terminated: m("Terminated", "neutral"),
  },
  partner: {
    applied: m("Applied", "info"),
    approved: m("Approved", "accent"),
    signed: m("Signed", "accent"),
    active: m("Active", "success"),
    suspended: m("Suspended", "danger"),
    rejected: m("Rejected", "neutral"),
    terminated: m("Terminated", "neutral"),
  },
  franchisee: {
    signed: m("Signed", "info"),
    active: m("Active", "success"),
    suspended: m("Suspended", "danger"),
    terminated: m("Terminated", "neutral"),
  },
  territory: {
    active: m("Active", "success"),
    inactive: m("Inactive", "neutral"),
  },
  planRequest: {
    pending: m("Pending review", "warning"),
    approved: m("Approved", "success"),
    rejected: m("Rejected", "danger"),
    cancelled: m("Cancelled", "neutral"),
  },
  featureFlag: {
    on: m("ON", "success"),
    off: m("OFF", "neutral"),
  },
  health: {
    healthy: m("Healthy", "success"),
    stable: m("Stable", "info"),
    watch: m("Watch", "warning"),
    at_risk: m("At risk", "warning"),
    critical: m("Critical", "danger"),
    churned: m("Churned", "neutral"),
  },
  organization: {
    active: m("Active", "success"),
    trial: m("Trial", "info"),
    suspended: m("Suspended", "warning"),
    cancelled: m("Cancelled", "neutral"),
  },
};

/** snake_case / camelCase → "Past due" style words. */
export function humanizeStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusMeta(domain: string, status: string | null | undefined): StatusMeta {
  if (!status) return { label: "Unknown", tone: "neutral" };
  const key = String(status).trim();
  const map = STATUS_MAP[domain];
  const direct = map?.[key];
  if (direct) return direct;
  const lowered = map?.[key.toLowerCase()];
  if (lowered) return lowered;
  return { label: humanizeStatus(key), tone: "neutral" };
}
