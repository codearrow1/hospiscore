"use client";

import { useEffect, useMemo, useState } from "react";

interface Application {
  id: string;
  affiliateName: string;
  email: string;
  website?: string | null;
  audience?: string | null;
  socialProfiles?: string | null;
  promotionMethod?: string | null;
  geography?: string | null;
  niche?: string | null;
  expectedTraffic?: string | null;
  planDescription?: string | null;
  status: string;
  reviewNote?: string | null;
  createdAt: string;
}

type Filter = "all" | "pending" | "approved" | "rejected";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";
const btnSuccess =
  "rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50";
const btnDanger =
  "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.pending}`}>
      {status}
    </span>
  );
}

export default function ApplicationReview() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/saas/affiliate-applications${params}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications ?? data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const reviewApplication = async (id: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch(`/api/saas/affiliate-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: reviewNotes[id] || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to update application");
        return;
      }
      setReviewNotes(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetchApplications();
    } finally {
      fetchApplications();
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: applications.length };
    for (const a of applications) {
      c[a.status] = (c[a.status] ?? 0) + 1;
    }
    return c;
  }, [applications]);

  const filtered = useMemo(() => {
    if (filter === "all") return applications;
    return applications.filter((a) => a.status === filter);
  }, [applications, filter]);

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading applications…</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Affiliate Applications</h2>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {(["all", "pending", "approved", "rejected"] as Filter[]).map((f) => (
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

      {/* Application cards */}
      <div className="space-y-3">
        {filtered.map((app) => (
          <div key={app.id} className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{app.affiliateName}</p>
                <p className="text-xs text-zinc-500">{app.email}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>

            <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {app.website && (
                <>
                  <dt className="text-xs text-zinc-500">Website</dt>
                  <dd className="break-all text-xs">{app.website}</dd>
                </>
              )}
              {app.audience && (
                <>
                  <dt className="text-xs text-zinc-500">Audience</dt>
                  <dd className="text-xs">{app.audience}</dd>
                </>
              )}
              {app.socialProfiles && (
                <>
                  <dt className="text-xs text-zinc-500">Social Profiles</dt>
                  <dd className="text-xs">{app.socialProfiles}</dd>
                </>
              )}
              {app.promotionMethod && (
                <>
                  <dt className="text-xs text-zinc-500">Promotion Method</dt>
                  <dd className="text-xs">{app.promotionMethod}</dd>
                </>
              )}
              {app.geography && (
                <>
                  <dt className="text-xs text-zinc-500">Geography</dt>
                  <dd className="text-xs">{app.geography}</dd>
                </>
              )}
              {app.niche && (
                <>
                  <dt className="text-xs text-zinc-500">Niche</dt>
                  <dd className="text-xs">{app.niche}</dd>
                </>
              )}
              {app.expectedTraffic && (
                <>
                  <dt className="text-xs text-zinc-500">Expected Traffic</dt>
                  <dd className="text-xs">{app.expectedTraffic}</dd>
                </>
              )}
            </dl>

            {app.planDescription && (
              <div className="mb-3 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                <p className="mb-0.5 font-bold text-zinc-500">Plan</p>
                {app.planDescription}
              </div>
            )}

            {app.reviewNote && (
              <div className="mb-3 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                <p className="mb-0.5 font-bold">Review Note</p>
                {app.reviewNote}
              </div>
            )}

            {app.status === "pending" && (
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <textarea
                  className={inputCls + " mb-2"}
                  rows={2}
                  placeholder="Review note (optional)"
                  value={reviewNotes[app.id] || ""}
                  onChange={(e) => setReviewNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button
                    className={btnSuccess}
                    onClick={() => reviewApplication(app.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className={btnDanger}
                    onClick={() => reviewApplication(app.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            <p className="mt-2 text-[11px] text-zinc-400">
              Applied {new Date(app.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="rounded-2xl border bg-white p-6 text-center text-sm text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800">
            No applications to review.
          </p>
        )}
      </div>
    </div>
  );
}
