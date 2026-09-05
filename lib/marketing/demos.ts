/**
 * Demo booking management (Phase 10 + 27) — bookings hang off leads, carry a
 * status lifecycle, and every change is recorded on the lead timeline.
 * The calendar UI renders from `listDemos`, and the scheduler is designed as
 * a seam for a future calendar-integration (availability "slots" below).
 */

import { randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import { addEvent } from "./events";
import { getLead } from "./leads";
import { DEMO_STATUSES, type DemoBooking, type DemoStatus } from "./types";

export type { DemoBooking, DemoStatus };

export const DEFAULT_SLOT_MINUTES = 45;
export const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

export interface DemoInput {
  leadId: string;
  startAt: string;
  durationMin?: number;
  status?: DemoStatus;
  assignedTo?: string;
  meetingUrl?: string;
  phone?: string;
  notes?: string;
  city?: string;
  country?: string;
}

export async function createDemo(input: DemoInput, byEmail?: string, target?: string): Promise<DemoBooking | null> {
  const lead = await getLead(input.leadId, target);
  if (!lead) return null;
  const booking: DemoBooking = {
    id: randomUUID(),
    leadId: input.leadId,
    startAt: input.startAt,
    durationMin: input.durationMin ?? DEFAULT_SLOT_MINUTES,
    status: input.status ?? "new",
    assignedTo: input.assignedTo,
    meetingUrl: input.meetingUrl,
    phone: input.phone ?? lead.phone,
    notes: input.notes,
    city: input.city ?? lead.city,
    country: input.country ?? lead.country,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeData(
    (d) => ({
      ...d,
      demoBookings: [...(d.demoBookings ?? []), booking],
      leads: (d.leads ?? []).map((l) =>
        l.id === input.leadId ? { ...l, demoId: booking.id, updatedAt: new Date().toISOString() } : l,
      ),
    }),
    target,
  );
  await addEvent(
    {
      leadId: input.leadId,
      type: "demo_booked",
      summary: `Demo booked for ${new Date(input.startAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      detail: input.notes,
      byEmail,
    },
    target,
  );
  return booking;
}

export async function listDemos(target?: string): Promise<DemoBooking[]> {
  const data = await readData(target);
  return (data.demoBookings ?? []).sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt),
  );
}

export async function getDemo(id: string, target?: string): Promise<DemoBooking | null> {
  const data = await readData(target);
  return (data.demoBookings ?? []).find((d) => d.id === id) ?? null;
}

export function isDemoStatus(v: unknown): v is DemoStatus {
  return typeof v === "string" && (DEMO_STATUSES as readonly string[]).includes(v);
}

export interface DemoPatch {
  startAt?: string;
  durationMin?: number;
  status?: DemoStatus;
  assignedTo?: string;
  meetingUrl?: string;
  notes?: string;
  phone?: string;
}

export async function updateDemo(
  id: string,
  patch: DemoPatch,
  byEmail?: string,
  target?: string,
): Promise<DemoBooking | null> {
  const demo = await getDemo(id, target);
  if (!demo) return null;
  if (patch.status && !isDemoStatus(patch.status)) throw new Error("Invalid demo status");

  const updated: DemoBooking = {
    ...demo,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeData(
    (d) => ({
      ...d,
      demoBookings: (d.demoBookings ?? []).map((b) => (b.id === id ? updated : b)),
    }),
    target,
  );

  const eventType =
    patch.status === "reschedule_requested" || (patch.startAt && patch.startAt !== demo.startAt)
      ? "demo_rescheduled"
      : patch.status === "cancelled"
        ? "demo_cancelled"
        : patch.status === "completed"
          ? "demo_completed"
          : patch.status === "converted"
            ? "converted"
            : "stage_changed";
  await addEvent(
    {
      leadId: demo.leadId,
      type: eventType,
      summary: `Demo ${describeDemoStatus(updated.status)}`,
      detail: [patch.notes, patch.startAt ? `Scheduled for ${patch.startAt}` : undefined].filter(Boolean).join(" · "),
      byEmail,
    },
    target,
  );
  if (updated.status === "completed") {
    await writeData(
      (d) => ({
        ...d,
        leads: (d.leads ?? []).map((l) =>
          l.id === demo.leadId ? { ...l, stage: "demo_completed", updatedAt: new Date().toISOString() } : l,
        ),
      }),
      target,
    );
  }
  return updated;
}

function describeDemoStatus(status: DemoStatus): string {
  const map: Record<DemoStatus, string> = {
    new: "recorded",
    confirmed: "confirmed",
    reschedule_requested: "reschedule requested",
    completed: "completed",
    no_show: "marked as no-show",
    cancelled: "cancelled",
    converted: "marked as converted",
  };
  return map[status] ?? status;
}

export async function deleteDemo(id: string, target?: string): Promise<boolean> {
  let removed = false;
  await writeData(
    (d) => {
      const before = (d.demoBookings ?? []).length;
      d.demoBookings = (d.demoBookings ?? []).filter((b) => b.id !== id);
      removed = before !== (d.demoBookings?.length ?? 0);
      return d;
    },
    target,
  );
  return removed;
}

/** Follow-up / reminder due now: confirmed or new demos happening soon or past. */
export function demoReminders(
  demos: readonly DemoBooking[],
  from = new Date(),
): DemoBooking[] {
  const window = from.getTime();
  return demos.filter((d) => {
    if (d.status === "cancelled" || d.status === "completed" || d.status === "no_show") return false;
    const start = Date.parse(d.startAt);
    const due = (start - window) / 86_400_000;
    return due <= 1; // within the next 24h
  });
}