import { readData, writeData } from "@/lib/db";
import { computeScore } from "@/lib/scoring";
import type { Property, RawSignals, ScoreGrade } from "@/lib/types";

/**
 * Saved-property operations (per-per-account), back on the shared account file.
 * Each function accepts an optional file `target` for tests.
 */

export interface SavedPoint {
  at: string; // ISO
  overall: number;
  grade: ScoreGrade;
}

export interface SavedProperty {
  slug: string;
  name: string;
  city: string;
  country: string;
  color: string;
  savedAt: string;
  signals: RawSignals;
  history: SavedPoint[];
}

const MAX_HISTORY = 30;

export async function listSaved(userId: string, target?: string): Promise<SavedProperty[]> {
  const data = await readData(target);
  return data.saved[userId] ?? [];
}

export function isSaved(userId: string, slug: string, target?: string): Promise<boolean> {
  return listSaved(userId, target).then((l) => l.some((s) => s.slug === slug));
}

export function getSaved(
  userId: string,
  slug: string,
  target?: string,
): Promise<SavedProperty | undefined> {
  return listSaved(userId, target).then((l) => l.find((s) => s.slug === slug));
}

/** Add a property to the owner's saved list. Idempotent. */
export async function addSaved(
  userId: string,
  property: Property,
  target?: string,
): Promise<SavedProperty> {
  const existing = await getSaved(userId, property.slug, target);
  if (existing) return existing;
  await writeData(
    (data) => {
      const list = data.saved[userId] ?? [];
      const now = new Date().toISOString();
      const score = computeScore(property.signals);
      const saved: SavedProperty = {
        slug: property.slug,
        name: property.name,
        city: property.city,
        country: property.country,
        color: property.color,
        savedAt: now,
        signals: property.signals,
        history: [{ at: now, overall: score.overall, grade: score.grade }],
      };
      return { ...data, saved: { ...data.saved, [userId]: [saved, ...list] } };
    },
    target,
  );
  return (await getSaved(userId, property.slug, target))!;
}

/** Remove a saved property. Returns true if it existed. */
export async function removeSaved(
  userId: string,
  slug: string,
  target?: string,
): Promise<boolean> {
  let removed = false;
  await writeData(
    (data) => {
      const list = data.saved[userId] ?? [];
      const next = list.filter((s) => s.slug !== slug);
      removed = next.length !== list.length;
      return { ...data, saved: { ...data.saved, [userId]: next } };
    },
    target,
  );
  return removed;
}

/** Append a fresh score-history snapshot (keeps history across sessions). */
export async function refreshSaved(
  userId: string,
  slug: string,
  target?: string,
): Promise<SavedProperty | undefined> {
  await writeData(
    (data) => {
      const list = data.saved[userId] ?? [];
      const idx = list.findIndex((s) => s.slug === slug);
      if (idx === -1) return data;
      const prev = list[idx];
      const now = new Date().toISOString();
      const score = computeScore(prev.signals);
      const updated: SavedProperty = {
        ...prev,
        history: [
          ...prev.history,
          { at: now, overall: score.overall, grade: score.grade },
        ].slice(-MAX_HISTORY),
      };
      const next = list.map((s, i) => (i === idx ? updated : s));
      return { ...data, saved: { ...data.saved, [userId]: next } };
    },
    target,
  );
  return getSaved(userId, slug, target);
}