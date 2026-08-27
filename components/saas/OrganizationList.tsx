"use client";

import { useEffect, useState, useCallback } from "react";

interface Org {
  id: string;
  legalName: string;
  businessName: string | null;
  country: string | null;
  industry: string | null;
  status: string;
  mrr: number;
  healthScore: number | null;
  createdAt: string;
  _count?: { properties: number; contacts: number; subscriptions: number };
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  suspended: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

export default function OrganizationList() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await fetch(`/api/saas/organizations?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setOrgs(data.organizations);
    } catch {
      setMsg({ type: "err", text: "Failed to load organizations" });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function formatMrr(cents: number) {
    return `$${(cents / 100).toFixed(0)}`;
  }

  const filtered = orgs.filter((o) =>
    !filter || o.status === filter
  );

  if (loading) return <div className="text-sm text-zinc-500">Loading organizations...</div>;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No organizations found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Country</th>
                <th className="px-4 py-3 font-semibold">Industry</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">MRR</th>
                <th className="px-4 py-3 font-semibold">Health</th>
                <th className="px-4 py-3 font-semibold">Properties</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.legalName}</div>
                    {o.businessName && <div className="text-xs text-zinc-400">{o.businessName}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{o.country || "—"}</td>
                  <td className="px-4 py-3 text-xs">{o.industry || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">{formatMrr(o.mrr)}</td>
                  <td className="px-4 py-3">
                    {o.healthScore !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700">
                          <div
                            className={`h-2 rounded-full ${o.healthScore >= 80 ? "bg-emerald-500" : o.healthScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${o.healthScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400">{o.healthScore}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{o._count?.properties ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {msg && (
        <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
