/**
 * Score snapshot worker.
 *
 * Recomputes and persists today's score for every property so trend/change
 * tracking works. This is intended to run on a schedule (cron / a worker), e.g.:
 *
 *   0 2 * * *  cd /path/to/app && npm run snapshot >> var/snapshot.log 2>&1
 *
 * In a real deployment, snapshot your claimed/live portfolio (from your DB)
 * instead of the demo dataset — swap `properties` for your own registry.
 */

import { properties } from "../lib/data";
import { takeSnapshot } from "../lib/scoreHistory";
import { dataMode } from "../lib/config";
import { computeScore } from "../lib/scoring";

async function main() {
  const mode = dataMode();
  console.log(
    `[snapshot] mode=${mode} date=${new Date().toISOString()} count=${properties.length}`,
  );

  const rows: { name: string; propertyId: string; overall: number; grade: string }[] = [];

  for (const prop of properties) {
    const result = computeScore(prop.signals);
    const snap = await takeSnapshot(prop.slug, prop, result);
    rows.push({
      name: prop.name,
      propertyId: prop.slug,
      overall: snap.overall,
      grade: snap.grade,
    });
  }

  for (const r of rows) {
    console.log(`${r.name.padEnd(28)} ${String(r.overall).padStart(3)} ${r.grade}`);
  }
  console.log(`[snapshot] done — ${rows.length} snapshots written to var/scores`);
}

main().catch((err) => {
  console.error("[snapshot] failed:", err);
  process.exit(1);
});