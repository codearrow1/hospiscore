/** SVG charts (no chart library) — server-safe, dark-theme aware. */
import { formatNumber, formatPct } from "@/lib/format";

/**
 * Screen-reader/keyboard alternative for every chart: the same numbers in a
 * real table, collapsed by default so visual design is unchanged.
 */
export function ChartTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-semibold text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
        View data as a table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line text-zinc-400">
              {head.map((h) => (
                <th key={h} scope="col" className="px-2 py-1 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                {r.map((c, j) => (
                  <td key={j} className={`px-2 py-1 ${j > 0 ? "tabular-nums" : ""}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function summarize(labelKey: string, data: { key: string; count: number }[]): string {
  const parts = data.slice(0, 4).map((d) => `${d.key}: ${d.count}`);
  const rest = data.length - Math.min(data.length, 4);
  const suffix = rest > 0 ? `, +${rest} more` : "";
  return `${labelKey} — bar chart. ${parts.join(", ")}${suffix}.`;
}

export function Bars({
  data,
  labelKey,
  max,
  barClass = "fill-indigo-500",
  height = 120,
}: {
  data: { key: string; count: number }[];
  labelKey: string;
  max?: number;
  barClass?: string;
  height?: number;
}) {
  const top = max ?? Math.max(...data.map((d) => d.count), 1);
  const w = 320;
  const gap = 4;
  const bw = Math.min(28, Math.max(8, (w - gap * (data.length - 1)) / Math.max(data.length, 1)));
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height + 26}`} className="w-full" role="img" aria-label={summarize(labelKey, data)}>
        {/* Y axis: max gridline + baseline for visual anchoring */}
        <line x1={0} y1={height} x2={w} y2={height} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={1} />
        <line x1={0} y1={0.5} x2={w} y2={0.5} className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth={1} strokeDasharray="3 3" />
        <text x={0} y={10} className="fill-zinc-300 text-[8px]">{formatNumber(top)}</text>
        {data.map((d, i) => {
          const h = (d.count / top) * height;
          const x = i * (bw + gap);
          return (
            <g key={d.key}>
              <rect x={x} y={height - h} width={bw} height={Math.max(h, 2)} rx={3} className={`${barClass} transition-[opacity] hover:opacity-80`}>
                <title>{`${d.key}: ${formatNumber(d.count)}`}</title>
              </rect>
              <text x={x + bw / 2} y={height + 14} textAnchor="middle" className="fill-zinc-400 text-[9px]">
                {trim(d.key)}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTable caption={labelKey} head={["Category", "Count"]} rows={data.map((d) => [d.key, formatNumber(d.count)])} />
    </div>
  );
}

export function Donut({
  data,
  size = 140,
  stroke = 18,
  centerLabel = "",
  centerValue,
}: {
  data: { key: string; count: number }[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const colors = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#84cc16", "#fb923c"];
  let offset = 0;
  const summary = `Donut chart${centerLabel ? ` of ${centerLabel}` : ""} — total ${centerValue ?? total}. ${data.map((d) => `${d.key}: ${d.count}`).join(", ")}.`;
  return (
    <div>
      <div className="flex items-center gap-4">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-[160px] shrink-0" role="img" aria-label={summary}>
        {data.map((d, i) => {
          const frac = total ? d.count / total : 0;
          const dash = frac * circ;
          const el = (
            <circle
              key={d.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${d.key}: ${formatNumber(d.count)} (${formatPct(frac, { digits: 1 })})`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
        <text x="50%" y="46%" textAnchor="middle" className="fill-zinc-100 text-sm font-bold">
          {centerValue ?? total}
        </text>
        <text x="50%" y="58%" textAnchor="middle" className="fill-zinc-400 text-[9px]">
          {centerLabel}
        </text>
      </svg>
        <ul className="min-w-0 space-y-1.5">
          {data.map((d, i) => (
            <li key={d.key} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
              <span className="truncate">{d.key}</span>
              <span className="ms-auto font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{formatNumber(d.count)}</span>
            </li>
          ))}
        </ul>
      </div>
      <ChartTable caption={centerLabel || "Distribution"} head={["Segment", "Count"]} rows={data.map((d) => [d.key, formatNumber(d.count)])} />
    </div>
  );
}

export function Line({
  data,
  height = 120,
}: {
  data: { day: string; leads: number; demos: number; views?: number }[];
  height?: number;
}) {
  const w = 320;
  const pad = 14;
  const max = Math.max(...data.map((d) => Math.max(d.leads, d.demos, d.views ?? 0)), 1);
  const pt = (v: number) => (1 - v / max) * height + 4;
  const series = (key: "leads" | "demos" | "views") =>
    data.map((d, i) => `${i * (w / Math.max(data.length - 1, 1)) + pad},${pt(d[key] ?? 0)}`).join(" ");
  const colors = { leads: "#6366f1", demos: "#22d3ee", views: "#94a3b8" } as const;
  const hasViews = data.some((d) => d.views !== undefined);
  const summary = `Line chart, 14-day trend — leads, demos${hasViews ? " and page views" : ""}. Latest day: ${data.at(-1)?.leads ?? 0} leads, ${data.at(-1)?.demos ?? 0} demos.`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height + 10}`} className="w-full" role="img" aria-label={summary}>
        {/* Baseline anchors the series visually */}
        <line x1={pad} y1={height + 4} x2={w} y2={height + 4} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={1} />
        {(["leads", "demos", "views"] as const).map((k) => (
          <polyline key={k} points={series(k)} fill="none" stroke={colors[k]} strokeWidth={2} strokeLinejoin="round" opacity={k === "views" ? 0.6 : 1}>
            <title>{`${k}: latest ${data.at(-1)?.[k] ?? 0}`}</title>
          </polyline>
        ))}
      </svg>
      {/* Legend (server-rendered, no JS) */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: colors.leads }} /> Leads</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: colors.demos }} /> Demos</li>
        {hasViews && (
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded opacity-60" style={{ background: colors.views }} /> Page views</li>
        )}
      </ul>
      <ChartTable
        caption="14-day trend"
        head={["Day", "Leads", "Demos", "Views"]}
        rows={data.map((d) => [d.day, formatNumber(d.leads), formatNumber(d.demos), d.views !== undefined ? formatNumber(d.views) : "—"])}
      />
    </div>
  );
}

function trim(s: string, n = 10): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}