import type { SavedProperty } from "@/lib/saved";
import { computeScore } from "@/lib/scoring";

/**
 * Weekly score-alert digest (pure, testable).
 *
 * Recomputes each saved property's score from its stored signals and compares
 * it to the last recorded history point. The digest lists changed properties
 * (with delta) and summarizes the rest.
 */

export interface AlertItem {
  slug: string;
  name: string;
  previous: number;
  current: number;
  delta: number;
  changed: boolean;
  grade: "Poor" | "Fair" | "Good" | "Excellent";
}

export interface AlertDigest {
  subject: string;
  html: string;
  items: AlertItem[];
  changedCount: number;
}

const GRADE: Record<string, AlertItem["grade"]> = {
  Poor: "Poor",
  Fair: "Fair",
  Good: "Good",
  Excellent: "Excellent",
};

export function buildAlertDigest(saved: SavedProperty[]): AlertDigest {
  const items: AlertItem[] = saved.map((s) => {
    const last = s.history[s.history.length - 1];
    const previous = last?.overall ?? 0;
    const result = computeScore(s.signals);
    const delta = Math.round((result.overall - previous) * 100) / 100;
    return {
      slug: s.slug,
      name: s.name,
      previous,
      current: result.overall,
      delta,
      changed: delta !== 0,
      grade: GRADE[result.grade] ?? "Fair",
    };
  });

  const changed = items.filter((i) => i.changed);
  const changedCount = changed.length;
  const subject = changedCount > 0
    ? `HospiScore: ${changedCount} saved propert${changedCount === 1 ? "y" : "ies"} changed`
    : "HospiScore: weekly score digest — no changes";

  const rows = items
    .map((i) => {
      const arrow = i.delta === 0 ? "→" : i.delta > 0 ? "▲" : "▼";
      const color = i.delta === 0 ? "#52525b" : i.delta > 0 ? "#059669" : "#dc2626";
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e4e4e7;"><a href="${i.slug}" style="color:#4338ca;text-decoration:none;font-weight:600;">${escapeHtml(i.name)}</a></td>
        <td style="padding:8px 10px;border-bottom:1px solid #e4e4e7;text-align:center;">${i.previous}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e4e4e7;text-align:center;color:${color};font-weight:700;">${arrow} ${i.current}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e4e4e7;text-align:center;">${i.grade}</td>
      </tr>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
    <h2 style="color:#18181b;margin:16px 0 4px;">Weekly score digest</h2>
    <p style="color:#71717a;margin:0 0 16px;">${changedCount > 0 ? `${changedCount} property${changedCount === 1 ? "" : "ies"} changed since last check.` : "No score changes since last check."}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#3f3f46;">
      <thead><tr style="background:#f4f4f5;">
        <th style="padding:8px 10px;text-align:left;">Property</th>
        <th style="padding:8px 10px;">Previous</th>
        <th style="padding:8px 10px;">Current</th>
        <th style="padding:8px 10px;">Grade</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#a1a1aa;font-size:11px;margin-top:16px;">HospiScore · refresh a saved property to record a new history point.</p>
  </div>`;

  return { subject, html, items, changedCount };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}