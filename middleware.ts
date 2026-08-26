import { NextResponse, type NextRequest } from "next/server";

/**
 * Global edge middleware — CSRF defense-in-depth for the SaaS control plane.
 *
 * Every mutating request under /api/saas (and auth logout) must present a
 * same-origin Origin header when it presents one at all. Cross-site form
 * posts always carry a mismatched Origin and are rejected here, once, for
 * every handler — including future ones.
 *
 * Requests WITHOUT an Origin header (server-to-server calls, curl, external
 * cron schedulers) pass through; their authorization still happens per-route
 * (session permissions or CRON_SECRET).
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.next();
  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get("host");
    if (!host || originHost.toLowerCase() !== host.toLowerCase()) {
      return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid Origin header" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/saas/:path*", "/api/auth/logout", "/api/account/:path*", "/api/saved/:path*", "/api/settings"],
};
