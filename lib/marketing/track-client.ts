/**
 * Client-side, fire-and-forget conversion-event beacon for the public site.
 *
 * Privacy-light: session-keyed only (sessionStorage), no cookies, no PII, no
 * fingerprint. Mirrors the page-view philosophy. Safe to call from any user
 * action (CTA clicks, form submissions); swallows errors so analytics never
 * breaks a flow. Reused across homepage + marketing surfaces (no duplicates).
 */

export type PublicEventName =
  | "demo_cta"
  | "score_cta"
  | "score_submit"
  | "pricing_view"
  | "property_type_view"
  | "property_type_select"
  | "property_type_cta"
  | "property_type_score_click"
  | "property_type_solution_click"
  | "score_section_view"
  | "score_category_hover"
  | "score_category_open"
  | "score_report_click"
  | "score_demo_click"
  | "integration_section_view"
  | "integration_category_select"
  | "integration_logo_hover"
  | "integration_logo_click"
  | "integration_request_click"
  | "integration_demo_click";

/**
 * Resolve a stable-per-tab session id from sessionStorage, else create one.
 */
export function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem("hospi_session");
    if (!id) {
      id =
        Math.random().toString(36).slice(2, 10) +
        Date.now().toString(36).slice(-6);
      window.sessionStorage.setItem("hospi_session", id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Fire a conversion event. Uses sendBeacon when available (keeps the request
 * alive on navigation). Never throws.
 */
export function track(name: PublicEventName, meta?: string): void {
  try {
    const body = JSON.stringify({ name, meta, session: sessionId() });
    const url = "/api/marketing/track-event";
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    }
  } catch {
    // analytics must never block or break the user flow
  }
}