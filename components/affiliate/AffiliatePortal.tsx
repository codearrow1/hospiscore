/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";

interface AffiliatePortalProps {
  affiliate: any;
}

type Tab = "dashboard" | "links" | "network" | "settings" | "assets";

export default function AffiliatePortal({ affiliate }: AffiliatePortalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [network, setNetwork] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recruitCode, setRecruitCode] = useState("");
  const [payoutMethod, setPayoutMethod] = useState(affiliate.payoutMethod || "bank");
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);

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

  const fetchNetwork = useCallback(async () => {
    try {
      const res = await fetch(`/api/saas/affiliates/${affiliate.id}/recruited`);
      if (res.ok) {
        const data = await res.json();
        setNetwork(data.recruited || []);
      }
    } catch (e) {
      console.error("Failed to load network", e);
    }
  }, [affiliate.id]);

  const fetchPayouts = useCallback(async () => {
    try {
      const res = await fetch(`/api/saas/payouts/${affiliate.id}`);
      if (res.ok) {
        const data = await res.json();
        setPayoutHistory(data.payouts || []);
      }
    } catch (e) {
      console.error("Failed to load payouts", e);
    }
  }, [affiliate.id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (activeTab === "network") fetchNetwork();
    if (activeTab === "settings") fetchPayouts();
  }, [activeTab, fetchNetwork, fetchPayouts]);

  const copyLink = () => {
    const link = `${window.location.origin}/ref/${affiliate.referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      alert("Referral link copied!");
    });
  };

  const handleRecruit = async () => {
    if (!recruitCode.trim()) {
      alert("Enter a referral code to recruit.");
      return;
    }
    try {
      const res = await fetch(`/api/saas/affiliates/${affiliate.id}/recruit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childReferralCode: recruitCode.trim() }),
      });
      if (res.ok) {
        alert("Affiliate recruited successfully!");
        setRecruitCode("");
        fetchNetwork();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to recruit.");
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  const handleUpdatePayout = async () => {
    try {
      const res = await fetch(`/api/saas/payouts/${affiliate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutMethod }),
      });
      if (res.ok) {
        alert("Payout method updated!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update.");
      }
    } catch (e) {
      alert("Network error.");
    }
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
                  {commissions.slice(0, 10).map((c: any) => (
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
              <h2 className="font-semibold text-gray-900 mb-4">QR Code</h2>
              <div className="flex justify-center">
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-40 h-40">
                    <rect width="100" height="100" fill="white" />
                    <rect x="10" y="10" width="25" height="25" fill="black" />
                    <rect x="65" y="10" width="25" height="25" fill="black" />
                    <rect x="10" y="65" width="25" height="25" fill="black" />
                    <rect x="15" y="15" width="15" height="15" fill="white" />
                    <rect x="70" y="15" width="15" height="15" fill="white" />
                    <rect x="15" y="70" width="15" height="15" fill="white" />
                    <rect x="18" y="18" width="9" height="9" fill="black" />
                    <rect x="73" y="18" width="9" height="9" fill="black" />
                    <rect x="18" y="73" width="9" height="9" fill="black" />
                    <rect x="40" y="10" width="5" height="5" fill="black" />
                    <rect x="50" y="15" width="5" height="5" fill="black" />
                    <rect x="45" y="25" width="5" height="5" fill="black" />
                    <rect x="10" y="40" width="5" height="5" fill="black" />
                    <rect x="20" y="45" width="5" height="5" fill="black" />
                    <rect x="30" y="50" width="5" height="5" fill="black" />
                    <rect x="40" y="40" width="5" height="5" fill="black" />
                    <rect x="50" y="50" width="5" height="5" fill="black" />
                    <rect x="60" y="40" width="5" height="5" fill="black" />
                    <rect x="70" y="50" width="5" height="5" fill="black" />
                    <rect x="80" y="40" width="5" height="5" fill="black" />
                    <rect x="40" y="60" width="5" height="5" fill="black" />
                    <rect x="50" y="70" width="5" height="5" fill="black" />
                    <rect x="60" y="60" width="5" height="5" fill="black" />
                    <rect x="70" y="70" width="5" height="5" fill="black" />
                    <rect x="80" y="80" width="5" height="5" fill="black" />
                    <rect x="60" y="80" width="5" height="5" fill="black" />
                    <rect x="40" y="80" width="5" height="5" fill="black" />
                    <rect x="80" y="60" width="5" height="5" fill="black" />
                  </svg>
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 mt-3">QR code for your referral link</p>
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

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Your Network</h2>
              </div>
              {network.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">No recruited affiliates yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {network.map((a: any) => (
                    <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.user?.name || a.referralCode}</p>
                        <p className="text-xs text-gray-500">Joined {new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
                  <option value="crypto">Crypto</option>
                </select>
                <button onClick={handleUpdatePayout} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Update
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Payout History</h2>
              </div>
              {payoutHistory.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">No payouts yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {payoutHistory.map((p: any) => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.method || "Bank Transfer"}</p>
                        <p className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">{formatCents(p.amount)}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${p.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "assets" && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Creative Assets</h2>
            </div>
            <div className="px-4 py-8 text-center text-gray-500">
              {affiliate.campaign?.assets?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {affiliate.campaign.assets.map((asset: any, i: number) => (
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
