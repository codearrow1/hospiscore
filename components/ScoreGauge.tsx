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
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
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
        <span className="text-5xl font-bold tabular-nums tracking-tight" style={{ color }}>
          {score}
        </span>
        <span
          className="mt-1 rounded-full px-3 py-0.5 text-sm font-semibold"
          style={{ color, backgroundColor: `${color}1a` }}
        >
          {grade}
        </span>
      </div>
    </div>
  );
}
