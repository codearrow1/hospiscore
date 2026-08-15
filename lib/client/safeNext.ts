/**
 * Client-side safe redirect target from the `?next=` query param.
 * Only allows same-origin, app-internal paths (no open redirects).
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null; // absolute URLs / protocol-relative
  if (raw.startsWith("//")) return null; // protocol-relative → external host
  if (raw.startsWith("/\\")) return null; // backslash trick
  return raw;
}