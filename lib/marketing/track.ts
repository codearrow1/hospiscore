/**
 * Privacy-light page-view tracking (no cookies, no raw PII).
 *
 * The public site sends a beacon per page view with path, referrer, UTM and a
 * session id generated in the client (sessionStorage). The store keeps only
 * what the dashboard needs (no IP, no user agent, no fingerprint).
 */

import { randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import type { PageView } from "./types";

export interface TrackInput {
  path: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  country?: string;
  session: string;
}

const MAX_VIEWS = 100_000;
const MAX_PATH = 400;
/** Strip cross-origin referrers to their origin only (no query leakage). */
export function cleanReferrer(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.host === "thebuddharice.online") return u.pathname + u.search;
    return u.host + u.pathname;
  } catch {
    return undefined;
  }
}

export function cleanPath(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s.startsWith("/")) return null;
  if (
    s.startsWith("/marketing-admin") ||
    s.startsWith("/account") ||
    s.startsWith("/api") ||
    s.startsWith("/property/") ||
    s.startsWith("/properties/")
  ) {
    return null;
  }
  return s.slice(0, MAX_PATH);
}

export function validateTrackInput(input: Partial<TrackInput>): TrackInput | null {
  const path = cleanPath(input.path);
  if (!path) return null;
  return {
    path,
    referrer: cleanReferrer(input.referrer) ?? undefined,
    utmSource: input.utmSource?.toString().slice(0, 100),
    utmMedium: input.utmMedium?.toString().slice(0, 100),
    utmCampaign: input.utmCampaign?.toString().slice(0, 120),
    utmContent: input.utmContent?.toString().slice(0, 120),
    utmTerm: input.utmTerm?.toString().slice(0, 120),
    country: /^[A-Za-z]{2}$/.test(input.country ?? "") ? input.country!.toUpperCase() : undefined,
    session: input.session?.toString().slice(0, 64) || randomUUID(),
  };
}

/** Record a page view. Light dedupe: same session+path within 30s is skipped. */
export async function recordView(
  input: TrackInput,
  target?: string,
): Promise<PageView | null> {
  const data = await readData(target);
  const views = data.pageViews ?? [];
  const recent = views.filter((v) => v.session === input.session && v.path === input.path);
  const last = recent[recent.length - 1];
  if (last && Date.now() - Date.parse(last.at) < 30_000) return null;

  const view: PageView = {
    id: randomUUID(),
    at: new Date().toISOString(),
    path: input.path,
    referrer: input.referrer,
    utmCampaign: input.utmCampaign,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    country: input.country,
    session: input.session,
  };
  await writeData(
    (d) => ({
      ...d,
      pageViews: [...(d.pageViews ?? []), view].slice(-MAX_VIEWS),
    }),
    target,
  );
  return view;
}

export async function viewCount(target?: string): Promise<number> {
  const data = await readData(target);
  return data.pageViews?.length ?? 0;
}