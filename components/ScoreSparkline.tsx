/** Minimal inline SVG line chart for a saved property's score history. */
export default function ScoreSparkline({
  points,
  width = 132,
  height = 36,
}: {
  points: { at: string; overall: number }[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const min = Math.min(...points.map((p) => p.overall)) - 2;
  const max = Math.max(...points.map((p) => p.overall)) + 2;
  const span = Math.max(1, max - min);
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.overall - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pointsAttr = coords.join(" ");
  const last = coords[coords.length - 1];

  return (
    <div className="mt-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        className="overflow-visible"
      >
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-indigo-500"
        />
        <circle cx={last.split(",")[0]} cy={last.split(",")[1]} r={2.5} className="fill-indigo-600" />
      </svg>
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">
        Score history · {points.length} {points.length === 1 ? "point" : "points"}
      </p>
    </div>
  );
}