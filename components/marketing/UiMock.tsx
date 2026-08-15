/**
 * Product-UI screenshot placeholder.
 *
 * Renders a believable platform window (browser chrome + sidebar + content
 * skeleton) so the marketing pages feel like the real product today, and a
 * corner tag marks it as a placeholder. When the real product UI is ready,
 * pass `src` (e.g. `/images/product/dashboard.png`) and the skeleton is
 * swapped for the actual screenshot while keeping the same frame.
 *
 * Server-safe (no state, no events).
 */

export type UiMockVariant =
  | "dashboard"
  | "frontdesk"
  | "housekeeping"
  | "revenue"
  | "guest"
  | "calendar";

const SIDEBAR: { label: string }[] = [
  { label: "Dashboard" },
  { label: "Reservations" },
  { label: "Front desk" },
  { label: "Housekeeping" },
  { label: "Finance" },
  { label: "Guests" },
];

const NAV_INDEX: Record<UiMockVariant, number> = {
  dashboard: 0,
  frontdesk: 2,
  housekeeping: 3,
  revenue: 4,
  guest: 5,
  calendar: 1,
};

function Bar({ w, h = "h-3", className = "" }: { w: string; h?: string; className?: string }) {
  return <div className={`shimmer rounded-full ${h} ${w} ${className}`} />;
}

function StatCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
      <Bar w="w-12" h="h-2" />
      <div className="mt-2 flex items-end justify-between">
        <Bar w="w-10" h="h-5" />
        <Bar w="w-7" h="h-2" />
      </div>
    </div>
  );
}

function Row({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        active ? "border-indigo-800 bg-indigo-950/40" : "border-zinc-800/70 bg-zinc-900/50"
      }`}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800">
        <div className={`h-2 w-2 rounded-full ${active ? "bg-indigo-400" : "bg-zinc-600"}`} />
      </div>
      <div className="flex-1 space-y-1.5">
        <Bar w="w-2/5" h="h-2" />
        <Bar w="w-3/5" h="h-2" />
      </div>
      <Bar w="w-10" h="h-2" className="hidden sm:block" />
    </div>
  );
}

function Content({ variant }: { variant: UiMockVariant }) {
  if (variant === "dashboard") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard />
          <StatCard />
          <StatCard />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Bar w="w-24" />
            <Bar w="w-12" />
          </div>
          <div className="flex h-24 items-end gap-2">
            {["h-10", "h-16", "h-7", "h-20", "h-12", "h-24", "h-14", "h-9"].map((h, i) => (
              <div key={i} className={`shimmer flex-1 rounded-t ${h}`} />
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Row active />
          <Row />
        </div>
      </div>
    );
  }

  if (variant === "frontdesk") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Bar w="w-28" />
            <Bar w="w-16" h="h-2" />
          </div>
          <Bar w="w-20" h="h-6" className="rounded-lg" />
        </div>
        {[
          ["Arriving · 14:20", true],
          ["In-house · Room 204", false],
          ["Arriving · 15:05", true],
          ["Checking out · 11:00", false],
        ].map(([t, a]) => (
          <Row key={t as string} active={a as boolean} />
        ))}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Bar w="w-24" />
              <Bar w="w-14" h="h-2" />
            </div>
            <Bar w="w-16" h="h-2" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "housekeeping") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {["Clean", "Dirty", "Inspected"].map((s) => (
            <div key={s} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-center">
              <div
                className={`mx-auto mb-1.5 h-2 w-2 rounded-full ${
                  s === "Clean" ? "bg-emerald-400" : s === "Dirty" ? "bg-amber-400" : "bg-sky-400"
                }`}
              />
              <Bar w="w-10" h="h-2" className="mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[101, 102, 103, 104].map((n) => (
            <div key={n} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">{n}</span>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <Bar w="w-16" h="h-2" className="mt-2" />
            </div>
          ))}
        </div>
        <Row />
      </div>
    );
  }

  if (variant === "revenue") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard />
          <StatCard />
          <StatCard />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Bar w="w-28" />
            <div className="flex gap-1.5">
              <Bar w="w-8" h="h-4" className="rounded" />
              <Bar w="w-8" h="h-4" className="rounded" />
            </div>
          </div>
          <svg viewBox="0 0 300 90" className="h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points="0,70 30,58 60,64 90,40 120,48 150,28 180,36 210,18 240,26 270,12 300,16"
              fill="none"
              stroke="#818cf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="0,70 30,58 60,64 90,40 120,48 150,28 180,36 210,18 240,26 270,12 300,16"
              fill="url(#mockarea)"
              opacity="0.35"
            />
            <defs>
              <linearGradient id="mockarea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <Row />
      </div>
    );
  }

  if (variant === "guest") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bar w="w-8" h="h-8" className="rounded-full" />
          <div className="space-y-1">
            <Bar w="w-24" />
            <Bar w="w-12" h="h-2" />
          </div>
        </div>
        <div className="rounded-xl rounded-tl-sm border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <Bar w="w-3/4" />
        </div>
        <div className="ml-auto w-3/4 rounded-xl rounded-tr-sm border border-indigo-900 bg-indigo-950/50 px-3 py-2">
          <Bar w="w-2/3" className="bg-indigo-400/40" />
        </div>
        <div className="ml-auto w-2/3 rounded-xl rounded-tr-sm border border-indigo-900 bg-indigo-950/50 px-3 py-2">
          <Bar w="w-4/5" className="bg-indigo-400/40" />
        </div>
        <div className="rounded-xl rounded-tl-sm border border-zinc-800 bg-zinc-900/70 px-3 py-2">
          <Bar w="w-1/2" />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <Bar w="w-full" h="h-4" className="rounded-md" />
          <Bar w="w-10" h="h-6" className="rounded-md bg-indigo-500/50" />
        </div>
      </div>
    );
  }

  // calendar
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Bar w="w-28" />
        <div className="flex gap-1.5">
          <Bar w="w-8" h="h-5" className="rounded" />
          <Bar w="w-8" h="h-5" className="rounded" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-zinc-800/70 p-1 ${
              i % 5 === 0 ? "bg-indigo-950/40" : "bg-zinc-900/50"
            }`}
          >
            <span className="text-[9px] text-zinc-500">{i + 1}</span>
            <div className={`h-1 w-1 rounded-full ${i % 5 === 0 ? "bg-indigo-400" : "bg-zinc-700"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UiMock({
  variant = "dashboard",
  label,
  src,
  alt,
  className = "",
}: {
  variant?: UiMockVariant;
  /** Caption shown under the frame (replaces the placeholder tag when src set). */
  label?: string;
  /** Real product screenshot — replaces the skeleton when provided. */
  src?: string;
  alt?: string;
  className?: string;
}) {
  const activeNav = NAV_INDEX[variant];

  return (
    <figure className={`group/uimock ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-indigo-950/30 transition duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-700/20">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1 text-[10px] text-zinc-400">
            <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            app.hospios.com/{variant}
          </div>
          {!src && (
            <span className="rounded-full bg-indigo-950 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-300">
              UI preview
            </span>
          )}
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden w-40 shrink-0 border-r border-zinc-800 bg-zinc-900/60 p-3 sm:block">
            <div className="mb-3 flex items-center gap-2 px-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600">
                <div className="h-2 w-2 rounded-sm bg-white" />
              </div>
              <Bar w="w-14" h="h-2" />
            </div>
            <ul className="space-y-1">
              {SIDEBAR.map((item, i) => (
                <li key={item.label}>
                  <div
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                      i === activeNav ? "bg-indigo-950/60" : ""
                    }`}
                  >
                    <div
                      className={`h-2 w-2 shrink-0 rounded-sm ${
                        i === activeNav ? "bg-indigo-400" : "bg-zinc-600"
                      }`}
                    />
                    <Bar w="w-16" h="h-1.5" className={i === activeNav ? "bg-indigo-400/50" : ""} />
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1 p-4">
            <Content variant={variant} />
          </div>
        </div>

        {src && (
          // Real screenshot replaces the skeleton (same frame, same sizing).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? label ?? `HospiOS ${variant} screen`} loading="lazy" className="w-full" />
        )}
      </div>

      {label && (
        <figcaption className="mt-3 text-center text-sm text-zinc-400">{label}</figcaption>
      )}
    </figure>
  );
}
