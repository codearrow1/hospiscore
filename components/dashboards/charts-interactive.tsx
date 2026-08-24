"use client";

import { useRef, useState } from "react";

export type LineSeries = { name: string; color: string; values: number[] };

/** Multi-series line chart with axes and a hover tooltip. */
export function MultiLine({
  labels,
  series,
  height = 140,
  formatValue,
  ariaLabel = "Trend chart",
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatValue?: (v: number) => string;
  ariaLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const w = 560;
  const padL = 40;
  const padB = 18;
  const plotW = w - padL - 8;
  const n = Math.max(labels.length, 1);
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const x = (i: number) => padL + (i * plotW) / Math.max(n - 1, 1);
  const y = (v: number) => 4 + (1 - v / max) * height;
  const fmt = formatValue ?? ((v: number) => String(v));
  const ticks = [0, max / 2, max];

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !n) return;
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round(((px - padL) / plotW) * Math.max(n - 1, 1));
    setHover(Math.min(Math.max(idx, 0), n - 1));
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${height + padB}`}
        className="w-full touch-none"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
            <text x={padL - 4} y={y(t) + 3} textAnchor="end" className="fill-zinc-400 text-[9px] tabular-nums">
              {fmt(Math.round(t))}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height + 12} textAnchor={i === 0 ? "start" : "end"} className="fill-zinc-400 text-[9px]">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <polyline
            key={s.name}
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={4} y2={height} className="stroke-zinc-400 dark:stroke-zinc-600" strokeWidth={1} strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={3.5} fill={s.color} />
            ))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          style={{ left: `${Math.min(Math.max((x(hover) / w) * 100, 4), 78)}%` }}
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="mt-0.5 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}: <span className="font-semibold tabular-nums">{fmt(s.values[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Bar chart with a y-axis and per-bar hover tooltips. */
export function BarChart({
  data,
  barClass = "fill-indigo-500",
  height = 140,
  formatValue,
  ariaLabel = "Bar chart",
}: {
  data: { key: string; count: number }[];
  barClass?: string;
  height?: number;
  formatValue?: (v: number) => string;
  ariaLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 560;
  const padL = 40;
  const padB = 26;
  const plotW = w - padL - 8;
  const max = Math.max(...data.map((d) => d.count), 1);
  const gap = 6;
  const bw = Math.max(10, Math.min(36, (plotW - gap * Math.max(data.length - 1, 0)) / Math.max(data.length, 1)));
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${height + padB}`} className="w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {[0, max].map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + plotW} y1={4 + (1 - t / max) * height} y2={4 + (1 - t / max) * height} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
            <text x={padL - 4} y={4 + (1 - t / max) * height + 3} textAnchor="end" className="fill-zinc-400 text-[9px] tabular-nums">
              {fmt(Math.round(t))}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.count / max) * height;
          const x = padL + i * (bw + gap);
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)}>
              <rect
                x={x}
                y={4 + height - h}
                width={bw}
                height={Math.max(h, d.count > 0 ? 2 : 0)}
                rx={3}
                className={`${barClass} transition-opacity ${hover != null && hover !== i ? "opacity-60" : ""}`}
              />
              <text x={x + bw / 2} y={height + 16} textAnchor="middle" className="fill-zinc-400 text-[9px]">
                {d.key.length > 9 ? `${d.key.slice(0, 8)}…` : d.key}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && data[hover] && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          style={{ left: `${Math.min(Math.max(((padL + hover * (bw + gap)) / w) * 100, 4), 76)}%` }}
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{data[hover].key}</p>
          <p className="tabular-nums text-zinc-600 dark:text-zinc-300">{fmt(data[hover].count)}</p>
        </div>
      )}
    </div>
  );
}
