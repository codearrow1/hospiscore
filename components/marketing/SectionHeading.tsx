/**
 * Shared marketing section header (eyebrow + title + subtitle).
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const alignCls =
    align === "center" ? "mx-auto text-center" : "text-left";
  return (
    <div className={`max-w-2xl ${alignCls}`}>
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
        {align === "left" && (
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-indigo-400" aria-hidden="true" />
        )}
        {eyebrow}
        {align === "center" && (
          <span className="h-px w-6 bg-gradient-to-r from-indigo-400 to-transparent" aria-hidden="true" />
        )}
      </p>
      <h2 className="heading-line mt-3 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-zinc-400">{subtitle}</p>
      )}
    </div>
  );
}
