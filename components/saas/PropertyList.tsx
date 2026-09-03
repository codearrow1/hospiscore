"use client";

import { useEffect, useState, useCallback } from "react";

interface Property {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  rooms: number | null;
  status: string;
  createdAt: string;
}

interface Org {
  id: string;
  legalName: string;
}

export default function PropertyList({ organizationId }: { organizationId?: string }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState(organizationId || "");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Load org list for selector
  useEffect(() => {
    fetch("/api/saas/organizations")
      .then((r) => r.json())
      .then((d) => setOrgs(d.organizations || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!selectedOrg) {
      setProperties([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/saas/properties?organizationId=${selectedOrg}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setProperties(data.properties);
    } catch {
      setMsg({ type: "err", text: "Failed to load properties" });
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* Org selector */}
      <div>
        <label className="block text-sm font-medium mb-1">Organization</label>
        <select
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="">Select an organization...</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.legalName}</option>
          ))}
        </select>
      </div>

      {/* Properties */}
      {!selectedOrg ? (
        <p className="text-sm text-zinc-500">Select an organization to view its properties.</p>
      ) : loading ? (
        <div className="text-sm text-zinc-500">Loading properties...</div>
      ) : properties.length === 0 ? (
        <p className="text-sm text-zinc-500">No properties found for this organization.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">Country</th>
                <th className="px-4 py-3 font-semibold">Rooms</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-xs">{p.city || "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.country || "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.rooms ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(p.createdAt).toLocaleDateString()}
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
