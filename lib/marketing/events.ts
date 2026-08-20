/**
 * Lead activity timeline (Phase 17) — every meaningful touchpoint is recorded
 * here and the timeline is the primary workspace on the lead detail view.
 */

import { randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import type { LeadEvent, LeadEventType } from "./types";

export async function addEvent(
  input: {
    leadId: string;
    type: LeadEventType;
    summary: string;
    detail?: string;
    byEmail?: string;
  },
  target?: string,
): Promise<LeadEvent> {
  const event: LeadEvent = {
    id: randomUUID(),
    leadId: input.leadId,
    type: input.type,
    at: new Date().toISOString(),
    byEmail: input.byEmail,
    summary: input.summary,
    detail: input.detail,
  };
  await writeData(
    (d) => ({
      ...d,
      leadEvents: [...(d.leadEvents ?? []), event].slice(-5_000),
    }),
    target,
  );
  return event;
}

export async function eventsForLead(
  leadId: string,
  target?: string,
): Promise<LeadEvent[]> {
  const data = await readData(target);
  return (data.leadEvents ?? [])
    .filter((e) => e.leadId === leadId)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export async function recentEvents(
  limit = 15,
  target?: string,
): Promise<LeadEvent[]> {
  const data = await readData(target);
  return [...(data.leadEvents ?? [])]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}