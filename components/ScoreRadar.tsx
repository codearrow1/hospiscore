import type { ScoreComponent } from "@/lib/types";

const SHORT_LABELS: Record<string, string> = {
  ratingQuality: "Rating",
  reviewVolume: "Volume",
  reviewVelocity: "Velocity",
  responseRate: "Responses",
  platformDiversity: "Spread",
  guestExperience: "Experience",
  presence: "Presence",
  amenities: "Amenities",
  visualContent: "Photos",
  sustainability: "Eco",
  accessibility: "Access",
  directBookings: "Direct",
  brandTrust: "Trust",
};

export default function ScoreRadar({
  components,
  size = 280,
}: {
  components: ScoreComponent[];
  size?: number;
}) {
  const n = components.length || 1;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 36;
  const PAD = 5;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, value: number) => {
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };

  const rings = [20, 40, 60, 80, 100];

  return (
    <svg
      role="img"
      aria-label="Score radar across all 13 criteria"
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto h-auto w-full max-w-[280px]"
    >
      {rings.map((v) => {
        const pts = components.map((c, i) => point(i, v).join(",")).join(" ");
        return (
          <polygon
            key={v}
            points={pts}
            fill="none"
            stroke="currentColor"
            strokeOpacity={v === 100 ? 0.3 : 0.12}
            strokeWidth={1}
          />
        );
      })}

      {components.map((c, i) => {
        const p = point(i, 100);
        return (
          <line
            key={c.key}
            x1={cx}
            y1={cy}
            x2={p[0]}
            y2={p[1]}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={components.map((c, i) => point(i, c.score).join(",")).join(" ")}
        fill="#6366f1"
        fillOpacity={0.28}
        stroke="#4f46e5"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {components.map((c, i) => {
        const [x, y] = point(i, 100);
        const label = SHORT_LABELS[c.key] ?? c.label;
        const w = label.length * 4.8;
        const anchor: "end" | "start" | "middle" =
          x < cx - 2 ? "end" : x > cx + 2 ? "start" : "middle";
        const lx =
          anchor === "end"
            ? Math.max(x, PAD + w)
            : anchor === "start"
              ? Math.min(x, size - PAD - w)
              : Math.min(Math.max(x, PAD + w / 2), size - PAD - w / 2);
        const ly = Math.min(Math.max(y, PAD + 5), size - PAD - 5);
        return (
          <text
            key={c.key}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-zinc-400 text-[10px]"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}