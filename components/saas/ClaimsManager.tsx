"use client";

import { useCallback, useEffect, useState } from "react";

interface ClaimOrg {
  id: string;
  legalName: string;
  businessName: string | null;
}

interface Claim {
  id: string;
  placeId: string;
  propertyName: string;
  propertyCity: string | null;
  propertyCountry: string | null;
  address: string | null;
  googlePhone: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  acquisitionSource: string | null;
  acquisitionCampaign: string | null;
  status: string;
  reason: string | null;
  verified: boolean;
  verificationMethod: string | null;
  createdAt: string;
  organization: ClaimOrg;
}

export default function ClaimsManager({ canDecide }: { canDecide: boolean }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/saas/claims?status=${filter}`);
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json();
      setClaims(d.claims ?? []);
    } catch {
      setError("Failed to load claims");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/saas/claims/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision, reason: reason[id]?.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Decision failed");
        return;
      }
      setReason((r) => ({ ...r, [id]: "" }));
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-md px-3 py-1 text-sm font-medium capitalize transition " +
                (filter === f ? "bg-indigo-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800")
              }
            >
              {f}
            </button>
          ))}
        </div>
        {loading && <span className="text-sm text-zinc-500">Loading…</span>}
      </div>

      {error && <div className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</div>}

      {claims.length === 0 ? (
        <p className="text-sm text-zinc-500">No {filter === "pending" ? "pending " : ""}claims.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Listing</th>
                <th className="px-4 py-3 font-semibold">Requester</th>
                <th className="px-4 py-3 font-semibold">Attribution</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800/60 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.propertyName}</div>
                    <div className="text-xs text-zinc-500">
                      {[c.propertyCity, c.propertyCountry].filter(Boolean).join(", ") || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-zinc-800 dark:text-zinc-200">
                      {c.organization.businessName || c.organization.legalName}
                    </div>
                    <div className="text-zinc-500">{c.placeId}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                    {c.address && <div>{c.address}</div>}
                    {c.googlePhone && <div className="text-zinc-500">Google: {c.googlePhone}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                    {c.requesterName && <div>{c.requesterName}</div>}
                    {c.requesterEmail && <div>{c.requesterEmail}</div>}
                    {c.requesterPhone && <div>{c.requesterPhone}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                    <div>{c.acquisitionSource || "—"}</div>
                    {c.acquisitionCampaign && <div className="text-zinc-500">{c.acquisitionCampaign}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                        (c.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : c.status === "rejected"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400")
                      }
                    >
                      {c.status}
                    </span>
                    {c.reason && <div className="mt-1 text-xs text-zinc-500">{c.reason}</div>}
                    {c.status === "pending" && (
                      <div className="mt-1 text-xs">
                        {c.verified ? (
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            Verified{c.verificationMethod ? ` · ${c.verificationMethod}` : ""}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">Not verified</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "pending" && canDecide ? (
                      <div className="space-y-1.5">
                        {!c.verified && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Owner must verify this claim before approval.
                          </p>
                        )}
                        <input
                          value={reason[c.id] ?? ""}
                          onChange={(e) => setReason((r) => ({ ...r, [c.id]: e.target.value }))}
                          placeholder="Reason (optional)"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => decide(c.id, "approved")}
                            disabled={busyId === c.id || !c.verified}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                            title={c.verified ? "Approve claim" : "Verify ownership before approving"}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => decide(c.id, "rejected")}
                            disabled={busyId === c.id}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : c.status === "pending" ? (
                      <span className="text-xs text-zinc-400">No decision permission</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
