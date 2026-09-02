"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnGhost } from "@/components/marketing-admin/ui";
import { startOfWeek, isoDay, type DemoRow, type DemoKpis, type DemoSortKey, type SortDir } from "@/lib/marketing/demosView";
import type { LeadEvent } from "@/lib/marketing/types";
import { DemosKpis } from "./DemosKpis";
import { DemosFilters, activeFilterCount, type DemosFilterState, type DemosFilterOptions } from "./DemosFilters";
import { DemoCalendarWeek } from "./DemoCalendarWeek";
import { DemoAgenda } from "./DemoAgenda";
import { DemoList } from "./DemoList";
import { DemoDetailDrawer } from "./DemoDetailDrawer";
import { BookDemoModal } from "./BookDemoModal";
import { shortDay } from "./demoUi";
import { buildDemosHref } from "@/lib/marketing/links";

const WEEK_MS = 7 * 86_400_000;

export function DemosWorkspace({
  demos,
  kpis,
  page,
  perPage,
  sort,
  dir,
  view,
  weekStart,
  team,
  leads,
  eventsByLead,
  rowsCount,
  currentFilters,
  options,
}: {
  demos: DemoRow[];
  kpis: DemoKpis;
  page: number;
  perPage: number;
  sort: DemoSortKey;
  dir: SortDir;
  view: "week" | "list" | "agenda";
  weekStart?: string;
  team: { id: string; name: string; email: string }[];
  leads: { id: string; name: string; email: string }[];
  eventsByLead: Record<string, LeadEvent[]>;
  rowsCount: number;
  currentFilters: DemosFilterState;
  options: DemosFilterOptions;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [tz, setTz] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBook, setShowBook] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [qDraft, setQDraft] = useState(currentFilters.q);

  useEffect(() => {
    setQDraft(currentFilters.q);
  }, [currentFilters.q]);

  // Client clock + timezone label (mount-after-hydration, like the old calendar).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offsetMin = -new Date().getTimezoneOffset();
      const sign = offsetMin >= 0 ? "+" : "-";
      const h = Math.floor(Math.abs(offsetMin) / 60);
      const m = Math.abs(offsetMin) % 60;
      setTz(`${zone} (UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""})`);
    } catch {
      setTz("local time");
    }
    return () => clearInterval(id);
  }, []);

  const anchor = useMemo(() => {
    if (weekStart) {
      const p = new Date(`${weekStart}T00:00:00`);
      if (!Number.isNaN(p.getTime())) return startOfWeek(p);
    }
    return startOfWeek(new Date(now));
  }, [weekStart, now]);

  const listRows = useMemo(() => demos.slice((page - 1) * perPage, page * perPage), [demos, page, perPage]);

  const href = (patch: Record<string, string | undefined>) =>
    buildDemosHref(currentFilters, { view, week: weekStart, sort, dir, page, perPage }, patch);

  const selected = selectedId ? demos.find((d) => d.id === selectedId) ?? null : null;

  const patchDemo = async (id: string, changes: Record<string, string | number | undefined>) => {
    setStatusMsg("");
    const res = await fetch(`/api/marketing/demos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatusMsg(data.error ?? "Update failed");
      return;
    }
    setStatusMsg(data.demo ? "Demo updated." : "Demo updated.");
    router.refresh();
  };

  const onBooked = () => {
    setShowBook(false);
    setStatusMsg("Demo booked.");
    router.refresh();
  };

  const filteredCount = demos.length;
  const activeFilter = activeFilterCount(currentFilters) > 0;
  const weekRange = `${shortDay(anchor)} – ${shortDay(new Date(anchor.getTime() + 6 * 86_400_000))}`;

  return (
    <div className="space-y-5">
      {statusMsg && (
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          {statusMsg}
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Demos</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {activeFilter ? `${filteredCount} of ${rowsCount} demos` : `${rowsCount} demo${rowsCount === 1 ? "" : "s"}`} · booked
            by sales or self-serve from the site demo forms. Change a status and the lead pipeline follows.
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setShowBook(true)}>Book a demo</button>
      </header>

      <DemosKpis kpis={kpis} href={href} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            {(["week", "list", "agenda"] as const).map((v) => (
              <a
                key={v}
                href={href({ view: v })}
                aria-current={view === v ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === v ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
              >
                {v}
              </a>
            ))}
          </div>
          {view !== "list" && (
            <div className="flex items-center gap-1.5 text-xs">
              <a href={href({ week: isoDay(new Date(anchor.getTime() - WEEK_MS)) })} className={btnGhost} aria-label="Previous week">←</a>
              <a href={href({ week: undefined })} title="Jump to current week" className="rounded-lg px-2 py-1.5 font-semibold text-zinc-600 hover:bg-surface-subtle dark:text-zinc-300">
                {weekRange}
              </a>
              <a href={href({ week: isoDay(new Date(anchor.getTime() + WEEK_MS)) })} className={btnGhost} aria-label="Next week">→</a>
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Times in your timezone{tz ? <> — <span className="font-medium">{tz}</span></> : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(href({ q: qDraft || undefined }));
          }}
        >
          <input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Search name, email, property, city…"
            className="min-h-9 w-56 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-indigo-400 md:min-h-9"
            aria-label="Search demos"
          />
          <button type="submit" className={btnGhost}>Search</button>
        </form>
        <DemosFilters current={currentFilters} options={options} href={href} />
      </div>

      {view === "week" && <DemoCalendarWeek demos={demos} weekStart={weekStart} onOpen={setSelectedId} now={now} />}
      {view === "agenda" && <DemoAgenda demos={demos} onOpen={setSelectedId} now={now} />}
      {view === "list" && (
        <DemoList
          rows={listRows}
          total={filteredCount}
          page={page}
          perPage={perPage}
          totalPages={Math.max(1, Math.ceil(filteredCount / perPage))}
          sort={sort}
          dir={dir}
          onOpen={setSelectedId}
          makeHref={href}
        />
      )}

      <DemoDetailDrawer
        demo={selected}
        team={team}
        eventsByLead={eventsByLead}
        tzLabel={tz}
        onPatch={patchDemo}
        onClose={() => setSelectedId(null)}
      />

      <BookDemoModal
        open={showBook}
        onClose={() => setShowBook(false)}
        team={team}
        leads={leads}
        conflictRows={demos}
        tzLabel={tz}
        onBooked={onBooked}
      />
    </div>
  );
}