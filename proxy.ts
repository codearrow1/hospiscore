import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy: first-line owner-area guard.
 *
 * Only checks for the presence of the session cookie (cheap, edge-safe).
 * The real validation happens server-side (see the dashboard page), so a
 * forged cookie is never trusted.
 */
const COOKIE = process.env.APP_SESSION_COOKIE || "hs_session";

export default function proxy(request: NextRequest) {
  if (!request.cookies.has(COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Guard the "verified owner" dashboard only; everything else is public.
  matcher: ["/properties/:path*/dashboard"],
};