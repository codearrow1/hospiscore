/**
 * Shared site-level SEO constants and helpers.
 */

export const SITE_NAME = "HospiOS";
export const SITE_TAGLINE = "The all-in-one Hotel PMS";
export const SITE_DESCRIPTION =
  "The all-in-one hotel property management system. Front desk, reservations, housekeeping, restaurant POS, finance, HRMS, channel manager, and AI automation in one platform. Free online presence score.";

/**
 * Canonical origin. Override with NEXT_PUBLIC_SITE_URL once the vanity
 * domain (e.g. hospios.com) forwards to the production host. The fallback
 * keeps canonical/og/sitemap URLs pointing at the real host until then.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://thebuddharice.online";

/** Dynamic Open Graph image URL (rendered by app/og/route.tsx). */
export function ogImage(title: string): string {
  return `/og?title=${encodeURIComponent(title)}`;
}
