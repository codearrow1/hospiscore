"use client";

import { useEffect, useMemo, useState } from "react";

interface FraudCase {
  id: string;
  affiliateId: string;
  affiliateName?: string;
  affiliateEmail?: string;
  riskScore: number;
  reasons: string[];
  status: string;
  resolution?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
}

type Filter = "all" | "open" | "investigating" | "resolved" | "dismissed";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  investigating: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  dismissed: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
};

const RESOLUTIONS = [
  { value: "no_action", label: "No Action" },
  { value: "warning", label: "Warning" },
  { value: "commission_hold", label: "Commission Hold" },
  { value: "account_suspend", label: "Suspend Account" },
  { value: "account_terminate", label: "Terminate Account" },
];

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";
const btnPrimary =
  "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

function riskColor(score: number) {
  if (score < 30) return "text-green-600 dark:text-green-400";
  if (score <= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function riskBg(score: number) {
  if (score < 30) return "bg-green-100 dark:bg-green-900/30";
  if (score <= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.open}`}>
      {status}
    </span>
  );
}

export default function FraudDashboard() {
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/saas/affiliate-fraud${params}`);
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases ?? data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [filter]);

  const transitionStatus = async (id: string, to: string) => {
    const res = await fetch(`/api/saas/affiliate-fraud/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    if (!res.ok) {
      alert("Failed to update status");
      return;
    }
    fetchCases();
  };

  const resolveCase = async (id: string) => {
    const res = await fetch(`/api/saas/affiliate-fraud/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        resolution,
        resolutionNote: resolutionNote || undefined,
      }),
    });
    if (!res.ok) {
      alert("Failed to resolve case");
      return;
    }
    setResolvingId(null);
    setResolution("");
    setResolutionNote("");
    fetchCases();
  };

  const runRiskCheck = async (affiliateId: string) => {
    setCheckingId(affiliateId);
    try {
      const res = await fetch(`/api/saas/affiliates/${affiliateId}/risk-check`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Risk check failed");
        return;
      }
      alert("Risk check completed");
      fetchCases();
    } finally {
      setCheckingId(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: cases.length };
    for (const cs of cases) c[cs.status] = (c[cs.status] ?? 0) + 1;
    return c;
  }, [cases]);

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading fraud cases…</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Fraud Dashboard</h2>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {(["all", "open", "investigating", "resolved", "dismissed"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              filter === f
                ? "bg-blue-600 text-white font-medium"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] ?? 0})
          </button>
        ))}
      </div>

      {/* Case cards */}
      <div className="space-y-3">
        {cases.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{c.affiliateName ?? c.affiliateId}</p>
                <p className="text-xs text-zinc-500">{c.affiliateEmail ?? ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${riskBg(c.riskScore)} ${riskColor(c.riskScore)}`}>
                  {c.riskScore}
                </div>
                <StatusBadge status={c.status} />
              </div>
            </div>

            {c.reasons.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Reasons</p>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                  {c.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {c.resolution && (
              <div className="mb-3 rounded-lg bg-zinc-50 p-2.5 text-xs dark:bg-zinc-800/50">
                <p className="font-bold text-zinc-500">Resolution: {c.resolution}</p>
                {c.resolutionNote && <p className="mt-0.5 text-zinc-500">{c.resolutionNote}</p>}
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {/* Risk check button */}
              <button
                className={btnGhost + " !text-xs"}
                disabled={checkingId === c.affiliateId}
                onClick={() => runRiskCheck(c.affiliateId)}
              >
                {checkingId === c.affiliateId ? "Checking…" : "Run Risk Check"}
              </button>

              {/* Status transitions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.status === "open" && (
                  <button
                    className={btnPrimary + " !py-1 !text-xs"}
                    onClick={() => transitionStatus(c.id, "investigating")}
                  >
                    Start Investigation
                  </button>
                )}
                {c.status === "investigating" && (
                  <>
                    <button
                      className={btnPrimary + " !py-1 !text-xs"}
                      onClick={() => setResolvingId(c.id)}
                    >
                      Resolve
                    </button>
                    <button
                      className={btnGhost + " !py-1 !text-xs !border-zinc-300 !text-zinc-600"}
                      onClick={() => transitionStatus(c.id, "dismissed")}
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>

              {/* Resolve form */}
              {resolvingId === c.id && (
                <div className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium">Resolution</label>
                      <select
                        className={inputCls}
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {RESOLUTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Note</label>
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Optional resolution note"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className={btnPrimary + " !py-1 !text-xs"}
                      disabled={!resolution}
                      onClick={() => resolveCase(c.id)}
                    >
                      Confirm Resolve
                    </button>
                    <button
                      className={btnGhost + " !py-1 !text-xs"}
                      onClick={() => { setResolvingId(null); setResolution(""); setResolutionNote(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-2 text-[11px] text-zinc-400">
              Created {new Date(c.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}

        {cases.length === 0 && (
          <p className="rounded-2xl border bg-white p-6 text-center text-sm text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800">
            No fraud cases found.
          </p>
        )}
      </div>
    </div>
  );
}
