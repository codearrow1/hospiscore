/**
 * Privacy-light named conversion events for the public site (no cookie, no raw
 * PII). Distinct from the lead-activity timeline in ./events.ts — these are
 * anonymous marketing events (e.g. "demo_cta", "score_submit") keyed by session
 * only, kept in a separate store array so they never touch page views or the
 * operational data model.
 */

import { randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import type { MarketingEvent } from "./types";

export const MAX_EVENTS = 100_000;
export const MAX_NAME = 60;
export const MAX_META = 200;

export interface MarketingEventInput {
  name: string;
  meta?: string;
  country?: string;
  session: string;
}

export function validateMarketingEvent(
  input: Partial<MarketingEventInput>,
): MarketingEventInput | null {
  const name = input.name?.toString().trim().slice(0, MAX_NAME);
  if (!name) return null;
  return {
    name,
    meta: input.meta?.toString().slice(0, MAX_META),
    country: /^[A-Za-z]{2}$/.test(input.country ?? "")
      ? input.country!.toUpperCase()
      : undefined,
    session: input.session?.toString().slice(0, 64) || randomUUID(),
  };
}

/** Record a named conversion event. Light dedupe: same session+name within 30s. */
export async function recordMarketingEvent(
  input: MarketingEventInput,
  target?: string,
): Promise<MarketingEvent | null> {
  const data = await readData(target);
  const events = data.marketingEvents ?? [];
  const recent = events.filter((e) => e.session === input.session && e.name === input.name);
  const last = recent[recent.length - 1];
  if (last && Date.now() - Date.parse(last.at) < 30_000) return null;

  const event: MarketingEvent = {
    id: randomUUID(),
    name: input.name,
    meta: input.meta,
    at: new Date().toISOString(),
    country: input.country,
    session: input.session,
  };
  await writeData(
    (d) => ({
      ...d,
      marketingEvents: [...(d.marketingEvents ?? []), event].slice(-MAX_EVENTS),
    }),
    target,
  );
  return event;
}

export async function marketingEventCount(target?: string): Promise<number> {
  const data = await readData(target);
  return data.marketingEvents?.length ?? 0;
}