/**
 * Routing validation (Phase L) — pure, typed checks over the provider registry
 * used by the admin routing editor to surface actionable warnings BEFORE the
 * operator saves an invalid routing configuration. It mirrors (and never
 * changes) the actual router in factory.ts `resolveProvider`:
 *
 *   1. only enabled + routable (READY) providers are candidates;
 *   2. candidates are sorted by ascending numeric `priority`;
 *   3. among candidates, the configured `default` wins if it also supports the
 *      currency;
 *   4. otherwise the lowest-priority candidate is chosen.
 *
 * These warnings therefore always match what the runtime will actually do, so
 * an operator can trust "what you see is what routes".
 */
import type { ProviderIntegrationStatus } from "./types";
import { canRoutePayment } from "./types";

export type RoutingSeverity = "error" | "warning";

export interface RoutingIssue {
  severity: RoutingSeverity;
  code: string;
  providerId?: string;
  message: string;
}

/** Structural subset the router cares about — keeps the helper usable by both
 *  the typed server configs and the looser client-side editor rows. */
export interface RoutableProviderView {
  id: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  integrationStatus: ProviderIntegrationStatus | string;
}

/** Route predicates over the structural view. */
function isRoutable(p: RoutableProviderView): boolean {
  const status = p.integrationStatus as ProviderIntegrationStatus | undefined;
  return canRoutePayment(status, p.enabled);
}

/** Warnings that apply regardless of the unsaved edits (config-driven only). */
export function validateRouting(configs: RoutableProviderView[]): RoutingIssue[] {
  const issues: RoutingIssue[] = [];
  const providers = configs.filter((c) => c && c.id);
  const enabled = providers.filter((c) => c.enabled);
  const routable = enabled.filter(isRoutable);
  const defaults = enabled.filter((c) => c.isDefault);

  // 1) A default provider that can never be routed is a silent footgun: the
  //    router only honours the default among candidates, so it may be ignored.
  for (const d of defaults) {
    if (!isRoutable(d)) {
      issues.push({
        severity: "error",
        code: "DEFAULT_NOT_ROUTABLE",
        providerId: d.id,
        message: `"${d.label}" is marked as the default provider but is ${statusText(d.integrationStatus as ProviderIntegrationStatus)} and cannot be routed. Define the default among a Routable provider, or it will be silently ignored.`,
      });
    }
  }

  // 2) More than one enabled default is invalid (the store would de-default
  //    others on save, but the unsaved editor state should flag it).
  if (defaults.length > 1) {
    issues.push({
      severity: "error",
      code: "MULTIPLE_DEFAULTS",
      message: `Multiple providers are marked default (${defaults.map((d) => d.id).join(", ")}). Only one default is allowed; the others will be unset on save.`,
    });
  }

  // 3) Ambiguous priority ordering among routable (or even enabled) providers.
  const active = enabled.length > 0 ? enabled : providers;
  const byPriority = new Map<number, RoutableProviderView[]>();
  for (const c of active) {
    const list = byPriority.get(c.priority) ?? [];
    list.push(c);
    byPriority.set(c.priority, list);
  }
  for (const [priority, group] of byPriority) {
    if (group.length > 1 && group.some(isRoutable)) {
      issues.push({
        severity: "warning",
        code: "DUPLICATE_PRIORITY",
        message: `Providers ${group.map((c) => c.id).join(", ")} share priority ${priority}. Order between them is ambiguous; assign distinct priorities for deterministic routing.`,
      });
    }
  }

  // 4) Enabled but not-yet-routable providers will simply be skipped by the
  //    router — surface so operators do not assume they are live.
  for (const c of enabled) {
    if (!isRoutable(c)) {
      issues.push({
        severity: "warning",
        code: "ENABLED_NOT_ROUTABLE",
        providerId: c.id,
        message: `"${c.label}" is enabled but ${statusText(c.integrationStatus as ProviderIntegrationStatus)}, so it will NOT be routed until it is verified Ready.`,
      });
    }
  }

  // 5) No enabled, routable provider at all → no payments can be taken.
  if (enabled.length > 0 && routable.length === 0) {
    issues.push({
      severity: "error",
      code: "NO_ROUTABLE_PROVIDER",
      message: "No provider is both enabled and verified Ready, so checkout will fail. At least one provider must be enabled and have a successful connection test.",
    });
  }

  // 6) Routing without a default is fine (priority fallback) but worth noting.
  if (enabled.length > 0 && routable.length > 0 && defaults.length === 0) {
    issues.push({
      severity: "warning",
      code: "NO_DEFAULT",
      message: "No default provider is set. Routing will fall back to the lowest priority number among verified providers.",
    });
  }

  return issues;
}

function statusText(status: ProviderIntegrationStatus): string {
  switch (status) {
    case "ready": return "Ready";
    case "verify": return "wired (needs live test)";
    case "verifying": return "verifying";
    case "verification_failed": return "verification failed";
    case "misconfigured": return "misconfigured";
    case "disabled": return "disabled";
    case "registered": default: return "registered";
  }
}
