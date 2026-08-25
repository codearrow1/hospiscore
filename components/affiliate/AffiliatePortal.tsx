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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Affiliate Portal</h1>
          <p className="text-gray-600 mt-1">
            Campaign: <span className="font-medium">{affiliate.campaign?.name || "N/A"}</span> &middot;
            Code: <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">{affiliate.referralCode}</span>
          </p>
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {feedback && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            feedback.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {feedback.text}
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Clicks" value={stats?.totalClicks ?? 0} />
              <StatCard label="Conversions" value={stats?.totalConversions ?? 0} />
              <StatCard label="Total Earnings" value={formatCents(stats?.totalEarnings ?? 0)} isCurrency />
              <StatCard label="Pending Balance" value={formatCents(stats?.pendingBalance ?? 0)} isCurrency />
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Recent Commissions</h2>
              </div>
              {commissions.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">No commissions yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {commissions.slice(0, 10).map((c) => (
                    <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.description || "Commission"}</p>
                        <p className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-sm font-semibold ${c.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
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
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Your Referral Link</h2>
              <div className="flex items-center gap-3">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/ref/${affiliate.referralCode}`}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-mono bg-gray-50"
                />
                <button onClick={copyLink} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Your Referral URL</h2>
              <div className="flex items-center gap-3">
                <code className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-mono bg-gray-50 break-all">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/ref/${affiliate.referralCode}`}
                </code>
                <button onClick={copyLink} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Campaign Info</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-gray-500">Commission Model</dt>
                <dd className="font-medium text-gray-900">{affiliate.campaign?.commissionModel || "N/A"}</dd>
                <dt className="text-gray-500">Commission Value</dt>
                <dd className="font-medium text-gray-900">{affiliate.campaign?.commissionValue ?? "N/A"}</dd>
                <dt className="text-gray-500">Cookie Duration</dt>
                <dd className="font-medium text-gray-900">{affiliate.campaign?.cookieDays ?? "N/A"} days</dd>
                <dt className="text-gray-500">Recurring Duration</dt>
                <dd className="font-medium text-gray-900">
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
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Recruit an Affiliate</h2>
              <div className="flex gap-3">
                <input
                  value={recruitCode}
                  onChange={(e) => setRecruitCode(e.target.value)}
                  placeholder="Enter referral code to recruit"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm"
                />
                <button onClick={handleRecruit} className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
                  Recruit
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-500 text-center py-4">Network view coming soon</p>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Payout Method</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="upi">UPI</option>
                </select>
                <button onClick={handleUpdatePayout} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Update
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-500 text-center py-4">Contact admin for payout details</p>
            </div>
          </div>
        )}

        {activeTab === "assets" && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Creative Assets</h2>
            </div>
            <div className="px-4 py-8 text-center text-gray-500">
              {affiliate.campaign?.assets && affiliate.campaign.assets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {affiliate.campaign?.assets?.map((asset, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 text-left">
                      <p className="text-sm font-medium text-gray-900">{asset.name || `Asset ${i + 1}`}</p>
                      <p className="text-xs text-gray-500 mt-1">{asset.type || "Image"}</p>
                      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${isCurrency ? "text-green-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
