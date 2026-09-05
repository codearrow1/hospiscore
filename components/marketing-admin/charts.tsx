/** SVG charts (no chart library) — server-safe, dark-theme aware. */

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
    <svg viewBox={`0 0 ${w} ${height + 26}`} className="w-full" role="img" aria-label={labelKey}>
      {data.map((d, i) => {
        const h = (d.count / top) * height;
        const x = i * (bw + gap);
        return (
          <g key={d.key}>
            <rect x={x} y={height - h} width={bw} height={Math.max(h, 2)} rx={3} className={barClass} />
            <text x={x + bw / 2} y={height + 14} textAnchor="middle" className="fill-zinc-400 text-[9px]">
              <title>{d.key}</title>
              {trim(d.key)}
            </text>
          </g>
        );
      })}
    </svg>
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
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label="Distribution">
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
            />
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
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="truncate">{d.key}</span>
            <span className="ml-auto font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{d.count}</span>
          </li>
        ))}
      </ul>
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
  return (
    <svg viewBox={`0 0 ${w} ${height + 10}`} className="w-full" role="img" aria-label="14-day trend">
      {(["leads", "demos", "views"] as const).map((k) => (
        <polyline key={k} points={series(k)} fill="none" stroke={colors[k]} strokeWidth={2} strokeLinejoin="round" opacity={k === "views" ? 0.6 : 1} />
      ))}
    </svg>
  );
}

function trim(s: string, n = 10): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}