"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/marketing-admin/ui";

type Snapshot = {
  metric: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  pct: number | null;
  overage: number;
  alert: "ok" | "80" | "90" | "100" | "over";
};

export default function UsageDashboard({ orgs }: { orgs: { id: string; legalName: string }[] }) {
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [data, setData] = useState<Snapshot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/saas/usage?organizationId=${encodeURIComponent(id)}`);
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) setError(j.error ?? "Load failed");
    else setData(j.usage);
  };

  useEffect(() => { if (orgId) load(orgId); }, [orgId]);

  const alertColor: Record<string, string> = {
    ok: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    "80": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "90": "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    "100": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    over: "bg-red-600 text-white",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700">
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.legalName}</option>)}
        </select>
        <button onClick={() => load(orgId)} className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900">Refresh</button>
      </div>
      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {data && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <div key={s.metric} className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{s.metric}</span>
                <Badge className={alertColor[s.alert]}>{s.alert === "ok" ? "OK" : s.alert === "over" ? "OVER" : `${s.pct}%`}</Badge>
              </div>
              <p className="mt-2 text-sm"><span className="font-bold">{s.used}</span> / {s.limit ?? "∞"} <span className="text-zinc-500">{s.limit != null ? `· ${s.remaining} remaining` : ""}</span></p>
              {s.limit != null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={`h-full ${s.alert==="over"||s.alert==="100"?"bg-red-500":s.alert==="90"?"bg-orange-500":s.alert==="80"?"bg-amber-400":"bg-indigo-500"}`} style={{ width: `${Math.min(s.pct ?? 0, 100)}%` }} /></div>}
              {s.overage > 0 && <p className="mt-1 text-xs text-red-600">Overage: {s.overage}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-zinc-400">Limits from Plan (maxProperties/maxUsers/maxBookings/storageGb). Other metrics from UsageRecord. 80/90/100% alerts, over = quota exceeded — server enforces via enforceLimit().</p>
    </div>
  );
}
