import { promises as fs } from "node:fs";
import path from "node:path";
import type { Property, ScoreGrade, ScoreResult } from "@/lib/types";
import { CONFIG } from "@/lib/config";
import { computeScore } from "@/lib/scoring";

/**
 * Score history persistence.
 *
 * Default backend is a simple JSON file store (no DB required) writing to
 * `SCORE_HISTORY_DIR` (default `<project>/var/scores`). Swap the store for a
 * Postgres implementation behind the same interface when you add a database.
 */

export interface ScoreSnapshot {
  at: string; // ISO timestamp
  overall: number;
  grade: ScoreGrade;
  platformsCount: number;
  totalReviews: number;
}

export interface ScoreHistoryStore {
  save(propertyId: string, snapshot: ScoreSnapshot): Promise<void>;
  history(propertyId: string): Promise<ScoreSnapshot[]>;
}

const MAX_ENTRIES = 90; // ~3 months of daily snapshots

/** File-backed store. Exported for tests. */
export class FileScoreStore implements ScoreHistoryStore {
  private dir: string;

  /** Exported for tests. */
  constructor(dir: string) {
    this.dir = dir;
  }

  private file(propertyId: string): string {
    const safe = propertyId.replace(/[^a-zA-Z0-9-]/g, "-");
    return path.join(this.dir, `${safe}.json`);
  }

  async save(propertyId: string, snapshot: ScoreSnapshot): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const file = this.file(propertyId);
    let list: ScoreSnapshot[] = [];
    try {
      list = JSON.parse(await fs.readFile(file, "utf8")) as ScoreSnapshot[];
    } catch {
      // first snapshot
    }
    list.push(snapshot);
    await fs.writeFile(file, JSON.stringify(list.slice(-MAX_ENTRIES), null, 2), "utf8");
  }

  async history(propertyId: string): Promise<ScoreSnapshot[]> {
    try {
      const raw = await fs.readFile(this.file(propertyId), "utf8");
      return JSON.parse(raw) as ScoreSnapshot[];
    } catch {
      return [];
    }
  }
}

let store: ScoreHistoryStore | null = null;

export function getScoreStore(): ScoreHistoryStore {
  if (!store) {
    store = new FileScoreStore(CONFIG.scoreHistoryDir);
  }
  return store;
}

/** Compute + persist a snapshot for a property. Returns the snapshot. */
export async function takeSnapshot(
  propertyId: string,
  property: Property,
  result?: ScoreResult,
): Promise<ScoreSnapshot> {
  const score = result ?? computeFor(property);
  const snapshot: ScoreSnapshot = {
    at: new Date().toISOString(),
    overall: score.overall,
    grade: score.grade,
    platformsCount: score.platformsCount,
    totalReviews: score.totalReviews,
  };
  await getScoreStore().save(propertyId, snapshot);
  return snapshot;
}

function computeFor(property: Property): ScoreResult {
  return computeScore(property.signals);
}

/** Latest snapshot for a property, if any. */
export async function latestSnapshot(propertyId: string): Promise<ScoreSnapshot | null> {
  const h = await getScoreStore().history(propertyId);
  return h.length > 0 ? h[h.length - 1] : null;
}