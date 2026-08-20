/**
 * Shared site-level SEO constants and helpers.
 */

export const SITE_NAME = "HospiOS";
export const SITE_TAGLINE = "The all-in-one Hotel PMS";
export const SITE_DESCRIPTION =
  "The all-in-one hotel property management system. Front desk, reservations, housekeeping, restaurant POS, finance, HRMS, channel manager, and AI automation in one platform. Free online presence score.";

/**
 * Canonical origin. Override with NEXT_PUBLIC_SITE_URL once the vanity
 * domain (e.g. hospios.com) forwards to the production host. A localhost
 * or non-HTTPS override is ignored so canonicals never point at localhost.
 */
const ENV_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

function isUsableOrigin(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "https:" && !["localhost", "127.0.0.1"].includes(hostname);
  } catch {
    return false;
  }
}

export const SITE_URL =
  ENV_ORIGIN && isUsableOrigin(ENV_ORIGIN) ? ENV_ORIGIN : "https://thebuddharice.online";

/** Dynamic Open Graph image URL (rendered by app/og/route.tsx). */
export function ogImage(title: string): string {
  return `/og?title=${encodeURIComponent(title)}`;
}
