import { gradeForScore, gradeColor } from "@/lib/scoring";

export default function ScoreGauge({
  score,
  size = 190,
}: {
  score: number;
  size?: number;
}) {
  const grade = gradeForScore(score);
  const color = gradeColor(grade);
  const stroke = size * 0.075;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div className="relative w-full" style={{ maxWidth: size }}>
      <div className="relative aspect-square">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-zinc-200 dark:text-zinc-800"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold tabular-nums tracking-tight"
            style={{ color, fontSize: Math.round(size * 0.26) }}
          >
            {score}
          </span>
          <span
            className="mt-1 rounded-full px-2.5 py-0.5 font-semibold"
            style={{
              color,
              backgroundColor: `${color}1a`,
              fontSize: Math.max(10, Math.round(size * 0.075)),
            }}
          >
            {grade}
          </span>
        </div>
      </div>
    </div>
  );
}
