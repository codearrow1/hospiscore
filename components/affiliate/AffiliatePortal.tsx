"use client";

import { useState, useEffect, useCallback } from "react";

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  payoutMethod?: string;
  campaign?: {
    name?: string;
    slug?: string;
    commissionModel?: string;
    commissionValue?: number;
    cookieDays?: number;
    recurringDuration?: number;
    holdingPeriodDays?: number;
    assets?: Array<{ name?: string; type?: string; url: string }>;
  } | null;
}

interface Stats {
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  pendingBalance: number;
}

interface Commission {
  id: string;
  description?: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Recruit {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  status: string;
  tier: string;
  recruitedAt: string;
}

interface AffiliatePortalProps {
  affiliate: AffiliateData;
}

type Tab = "dashboard" | "links" | "network" | "settings" | "assets";

export default function AffiliatePortal({ affiliate }: AffiliatePortalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [recruitCode, setRecruitCode] = useState("");
  const [payoutMethod, setPayoutMethod] = useState(affiliate.payoutMethod || "bank");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [network, setNetwork] = useState<Recruit[] | null>(null);
  const [networkLoading, setNetworkLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  const showFeedback = useCallback((type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate/me");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setCommissions(data.commissions || []);
      }
    } catch (e) {
      console.error("Failed to load dashboard", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const fetchNetwork = useCallback(async () => {
    setNetworkLoading(true);
    setNetworkError(false);
    try {
      const res = await fetch("/api/affiliate/network");
      if (res.ok) {
        const data = await res.json();
        setNetwork(data.network || []);
      } else {
        setNetworkError(true);
      }
    } catch (e) {
      console.error("Failed to load network", e);
      setNetworkError(true);
    } finally {
      setNetworkLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  const copyLink = () => {
    const link = `${window.location.origin}/ref/${affiliate.referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      showFeedback("success", "Referral link copied!");
    });
  };

  const handleRecruit = async () => {
    if (!recruitCode.trim()) {
      showFeedback("error", "Enter a referral code to recruit.");
      return;
    }
    try {
      const res = await fetch("/api/affiliate/recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childReferralCode: recruitCode.trim() }),
      });
      if (res.ok) {
        showFeedback("success", "Affiliate recruited successfully!");
        setRecruitCode("");
        fetchNetwork();
      } else {
        const data = await res.json();
        showFeedback("error", data.error || "Failed to recruit.");
      }
    } catch {
      showFeedback("error", "Network error.");
    }
  };

  const handleUpdatePayout = async () => {
    showFeedback("error", "Payout method updates require admin approval. Please contact your affiliate manager.");
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "links", label: "Links" },
    { key: "network", label: "Network" },
    { key: "settings", label: "Settings" },
    { key: "assets", label: "Assets" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-ink-secondary">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Affiliate Portal</h1>
          <p className="text-ink-secondary mt-1">
            Campaign: <span className="font-medium">{affiliate.campaign?.name || "N/A"}</span> &middot;
            Code: <span className="font-mono text-sm bg-surface-subtle px-2 py-0.5 rounded">{affiliate.referralCode}</span>
          </p>
        </div>

        <div role="tablist" className="flex gap-1 border-b border-line mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-indigo-600 text-brand"
                  : "border-transparent text-ink-secondary hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {feedback && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
          }`}>
            {feedback.text}
          </div>
        )}

        {activeTab === "dashboard" && (
          <div role="tabpanel" id="panel-dashboard" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Clicks" value={stats?.totalClicks ?? 0} />
              <StatCard label="Conversions" value={stats?.totalConversions ?? 0} />
              <StatCard label="Total Earnings" value={formatCents(stats?.totalEarnings ?? 0)} isCurrency />
              <StatCard label="Pending Balance" value={formatCents(stats?.pendingBalance ?? 0)} isCurrency />
            </div>

            <div className="bg-surface rounded-lg border border-line">
              <div className="px-4 py-3 border-b border-line">
                <h2 className="font-semibold text-foreground">Recent Commissions</h2>
              </div>
              {commissions.length === 0 ? (
                <div className="px-4 py-8 text-center text-ink-secondary">No commissions yet.</div>
              ) : (
                <div className="divide-y divide-line">
                  {commissions.slice(0, 10).map((c) => (
                    <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.description || "Commission"}</p>
                        <p className="text-xs text-ink-secondary">{new Date(c.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-sm font-semibold ${c.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {formatCents(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "links" && (
          <div role="tabpanel" id="panel-links" className="space-y-6">
            <div className="bg-surface rounded-lg border border-line p-6">
              <h2 className="font-semibold text-foreground mb-4">Your Referral Link</h2>
              <div className="flex items-center gap-3">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/ref/${affiliate.referralCode}`}
                  className="flex-1 border border-zinc-300 rounded-lg px-4 py-2.5 text-sm font-mono bg-surface-subtle dark:border-zinc-700"
                />
                <button onClick={copyLink} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-500 whitespace-nowrap">
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-line p-6">
              <h2 className="font-semibold text-foreground mb-4">Your Referral URL</h2>
              <div className="flex items-center gap-3">
                <code className="flex-1 border border-zinc-300 rounded-lg px-4 py-2.5 text-sm font-mono bg-surface-subtle break-all dark:border-zinc-700">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/ref/${affiliate.referralCode}`}
                </code>
                <button onClick={copyLink} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-500 whitespace-nowrap">
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-line p-6">
              <h2 className="font-semibold text-foreground mb-3">Campaign Info</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-ink-secondary">Commission Model</dt>
                <dd className="font-medium text-foreground">{affiliate.campaign?.commissionModel || "N/A"}</dd>
                <dt className="text-ink-secondary">Commission Value</dt>
                <dd className="font-medium text-foreground">{affiliate.campaign?.commissionValue ?? "N/A"}</dd>
                <dt className="text-ink-secondary">Cookie Duration</dt>
                <dd className="font-medium text-foreground">{affiliate.campaign?.cookieDays ?? "N/A"} days</dd>
                <dt className="text-ink-secondary">Recurring Duration</dt>
                <dd className="font-medium text-foreground">
                  {affiliate.campaign?.recurringDuration === -1
                    ? "Lifetime"
                    : affiliate.campaign?.recurringDuration
                    ? `${affiliate.campaign.recurringDuration} months`
                    : "One-time"}
                </dd>
              </dl>
            </div>
          </div>
        )}

        {activeTab === "network" && (
          <div role="tabpanel" id="panel-network" className="space-y-6">
            <div className="bg-surface rounded-lg border border-line p-6">
              <h2 className="font-semibold text-foreground mb-4">Recruit an Affiliate</h2>
              <div className="flex gap-3">
                <input
                  value={recruitCode}
                  onChange={(e) => setRecruitCode(e.target.value)}
                  placeholder="Enter referral code to recruit"
                  className="flex-1 border border-zinc-300 rounded-lg px-4 py-2.5 text-sm dark:border-zinc-700"
                />
                <button onClick={handleRecruit} className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-500 whitespace-nowrap">
                  Recruit
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-line p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-foreground">Your Network</h2>
                {network !== null && (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {network.length} recruit{network.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {networkLoading ? (
                <div className="space-y-3" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
                    >
                      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                        <div className="h-2.5 w-3/5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : networkError ? (
                <div className="rounded-lg border border-dashed border-line p-6 text-center">
                  <p className="text-sm text-ink-secondary">
                    We couldn&apos;t load your network right now.{" "}
                    <button
                      onClick={fetchNetwork}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Try again
                    </button>
                  </p>
                </div>
              ) : network !== null && network.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-xl dark:bg-indigo-950/40">
                    👥
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">No recruits yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink-secondary">
                    Share your referral link above, then enter an affiliate&apos;s code here to add
                    them to your network. You&apos;ll earn on their sales too.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {network!.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {(r.name || r.email || "?")
                            .trim()
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                          <p className="truncate text-xs text-ink-secondary">{r.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-secondary sm:justify-end">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {r.tier}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium capitalize ${
                            r.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : r.status === "suspended"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="font-mono">{r.referralCode}</span>
                        <span>
                          {new Date(r.recruitedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div role="tabpanel" id="panel-settings" className="space-y-6">
            <div className="bg-surface rounded-lg border border-line p-6">
              <h2 className="font-semibold text-foreground mb-4">Payout Method</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="border border-zinc-300 rounded-lg px-4 py-2.5 text-sm dark:border-zinc-700"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="upi">UPI</option>
                </select>
                <button onClick={handleUpdatePayout} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-500">
                  Update
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-line p-6">
              <p className="text-sm text-ink-secondary text-center py-4">Contact admin for payout details</p>
            </div>
          </div>
        )}

        {activeTab === "assets" && (
          <div role="tabpanel" id="panel-assets" className="bg-surface rounded-lg border border-line">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="font-semibold text-foreground">Creative Assets</h2>
            </div>
            <div className="px-4 py-8 text-center text-ink-secondary">
              {affiliate.campaign?.assets && affiliate.campaign.assets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {affiliate.campaign?.assets?.map((asset, i) => (
                    <div key={i} className="border border-line rounded-lg p-4 text-left">
                      <p className="text-sm font-medium text-foreground">{asset.name || `Asset ${i + 1}`}</p>
                      <p className="text-xs text-ink-secondary mt-1">{asset.type || "Image"}</p>
                      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline mt-2 inline-block">
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                "No creative assets available for this campaign."
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, isCurrency }: { label: string; value: string | number; isCurrency?: boolean }) {
  return (
    <div className="bg-surface rounded-lg border border-line p-4">
      <p className="text-sm text-ink-secondary mb-1">{label}</p>
      <p className={`text-2xl font-bold ${isCurrency ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
