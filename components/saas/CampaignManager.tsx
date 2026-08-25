"use client";

import { useEffect, useMemo, useState } from "react";

interface Campaign {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  commissionModel: string;
  commissionValue: number;
  cookieDays: number;
  holdingPeriodDays: number;
  maxCommission?: number | null;
  minPayout: number;
  recurringDuration?: number | null;
  recurringLimit?: number | null;
  tier2OverrideRate?: number | null;
  tier3OverrideRate?: number | null;
  maxTierDepth: number;
  status: string;
  createdAt: string;
}

interface CampaignMember {
  id: string;
  affiliateId: string;
  affiliateName?: string;
  affiliateEmail?: string;
  joinedAt: string;
}

interface CampaignTier {
  id: string;
  tierName: string;
  minCustomers?: number | null;
  minMrr?: number | null;
  commissionValue?: number | null;
  threshold?: number | null;
  rate?: number | null;
  label?: string;
  bonus?: number | null;
}

interface SimResult {
  mrr: number;
  country: string;
  amount: number;
  model: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  ended: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
  archived: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";
const btnPrimary =
  "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
      {status}
    </span>
  );
}

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [simMrr, setSimMrr] = useState("");
  const [simCountry, setSimCountry] = useState("US");
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [tiers, setTiers] = useState<CampaignTier[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newMemberId, setNewMemberId] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    commissionModel: "percent_mrr_12",
    commissionValue: "10",
    cookieDays: "30",
    holdingPeriodDays: "30",
    maxCommission: "",
    minPayout: "5000",
    recurringDuration: "",
    recurringLimit: "",
    tier2OverrideRate: "",
    tier3OverrideRate: "",
    maxTierDepth: "3",
  });

  const [tierForm, setTierForm] = useState({ tierName: "", minCustomers: "", minMrr: "", commissionValue: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saas/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns ?? data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const createCampaign = async () => {
    const body = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: form.description,
      commissionModel: form.commissionModel,
      commissionValue: Number(form.commissionValue),
      cookieDays: Number(form.cookieDays),
      holdingPeriodDays: Number(form.holdingPeriodDays),
      maxCommission: form.maxCommission ? Number(form.maxCommission) : null,
      minPayout: Number(form.minPayout),
      recurringDuration: form.recurringDuration ? Number(form.recurringDuration) : null,
      recurringLimit: form.recurringLimit ? Number(form.recurringLimit) : null,
      tier2OverrideRate: form.tier2OverrideRate ? Number(form.tier2OverrideRate) : null,
      tier3OverrideRate: form.tier3OverrideRate ? Number(form.tier3OverrideRate) : null,
      maxTierDepth: Number(form.maxTierDepth),
    };
    const res = await fetch("/api/saas/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showFeedback("error", d.error ?? "Failed to create campaign");
      return;
    }
    setShowCreate(false);
    setForm({
      name: "", slug: "", description: "", commissionModel: "percent_mrr_12",
      commissionValue: "10", cookieDays: "30", holdingPeriodDays: "30",
      maxCommission: "", minPayout: "5000", recurringDuration: "",
      recurringLimit: "", tier2OverrideRate: "", tier3OverrideRate: "", maxTierDepth: "3",
    });
    fetchCampaigns();
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const next = currentStatus === "active" ? "paused" : "active";
    const res = await fetch(`/api/saas/campaigns/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      showFeedback("error", "Failed to update status");
      return;
    }
    fetchCampaigns();
  };

  const updateCampaign = async (id: string, fields: Partial<Campaign>) => {
    const res = await fetch(`/api/saas/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      showFeedback("error", "Failed to update campaign");
      return;
    }
    setEditingId(null);
    fetchCampaigns();
  };

  const simulate = async (campaignId: string) => {
    const res = await fetch(`/api/saas/campaigns/${campaignId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mrr: Number(simMrr), country: simCountry }),
    });
    if (!res.ok) {
      showFeedback("error", "Simulation failed");
      return;
    }
    const data = await res.json();
    setSimResult(data);
  };

  const fetchMembers = async (campaignId: string) => {
    const res = await fetch(`/api/saas/campaigns/${campaignId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? data ?? []);
    }
  };

  const addMember = async (campaignId: string) => {
    const res = await fetch(`/api/saas/campaigns/${campaignId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateId: newMemberId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showFeedback("error", d.error ?? "Failed to add member");
      return;
    }
    setNewMemberId("");
    fetchMembers(campaignId);
  };

  const fetchTiers = async (campaignId: string) => {
    const res = await fetch(`/api/saas/campaigns/${campaignId}/tiers`);
    if (res.ok) {
      const data = await res.json();
      setTiers(data.tiers ?? data ?? []);
    }
  };

  const addTier = async (campaignId: string) => {
    const res = await fetch(`/api/saas/campaigns/${campaignId}/tiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tierName: tierForm.tierName,
        minCustomers: tierForm.minCustomers ? Number(tierForm.minCustomers) : undefined,
        minMrr: tierForm.minMrr ? Number(tierForm.minMrr) : undefined,
        commissionValue: tierForm.commissionValue ? Number(tierForm.commissionValue) : undefined,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showFeedback("error", d.error ?? "Failed to add tier");
      return;
    }
    setTierForm({ tierName: "", minCustomers: "", minMrr: "", commissionValue: "" });
    fetchTiers(campaignId);
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setSimResult(null);
    setSimMrr("");
    setSimCountry("US");
    await Promise.all([fetchMembers(id), fetchTiers(id)]);
  };

  const editingCampaign = useMemo(
    () => campaigns.find((c) => c.id === editingId),
    [campaigns, editingId]
  );

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading campaigns…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Campaigns</h2>
        <button onClick={() => setShowCreate(true)} className={btnPrimary + " ml-auto"}>
          + New Campaign
        </button>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          feedback.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Campaign list */}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="hidden w-full text-left text-sm md:table">
          <thead>
            <tr className="text-xs uppercase text-zinc-400">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Cookie</th>
              <th className="px-3 py-2">Holding</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-zinc-500">{c.slug}</span>
                </td>
                <td className="px-3 py-2 text-xs">{c.commissionModel} · {c.commissionValue}</td>
                <td className="px-3 py-2 text-xs">{c.cookieDays}d</td>
                <td className="px-3 py-2 text-xs">{c.holdingPeriodDays}d</td>
                <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-3 py-2 space-x-1 whitespace-nowrap">
                  <button onClick={() => toggleStatus(c.id, c.status)} className={btnGhost + " !py-1 !text-xs"}>
                    {c.status === "active" ? "Pause" : "Activate"}
                  </button>
                  <button onClick={() => setEditingId(c.id)} className={btnGhost + " !py-1 !text-xs"}>
                    Edit
                  </button>
                  <button onClick={() => openDetail(c.id)} className={btnGhost + " !py-1 !text-xs"}>
                    Details
                  </button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-400">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile cards */}
        <ul className="divide-y md:hidden">
          {campaigns.map((c) => (
            <li key={c.id} className="space-y-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-xs text-zinc-500">{c.commissionModel} · {c.commissionValue} · {c.cookieDays}d cookie</p>
              <div className="flex flex-wrap gap-1 pt-1">
                <button onClick={() => toggleStatus(c.id, c.status)} className={btnGhost + " !py-1 !text-xs"}>
                  {c.status === "active" ? "Pause" : "Activate"}
                </button>
                <button onClick={() => setEditingId(c.id)} className={btnGhost + " !py-1 !text-xs"}>
                  Edit
                </button>
                <button onClick={() => openDetail(c.id)} className={btnGhost + " !py-1 !text-xs"}>
                  Details
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-bold">New Campaign</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Name *</label>
                <input className={inputCls} value={form.name} onChange={set("name")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Slug</label>
                <input className={inputCls} value={form.slug} onChange={set("slug")} placeholder="auto-generated" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Description</label>
                <textarea className={inputCls} rows={2} value={form.description} onChange={set("description")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Commission Model</label>
                <select className={inputCls} value={form.commissionModel} onChange={set("commissionModel")}>
                  <option value="percent_mrr_12">% of MRR x12</option>
                  <option value="fixed">Fixed amount</option>
                  <option value="percent_first">% first payment</option>
                  <option value="percent_mrr_recurring">% of MRR (recurring)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Commission Value</label>
                <input className={inputCls} type="number" value={form.commissionValue} onChange={set("commissionValue")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Cookie Days</label>
                <input className={inputCls} type="number" value={form.cookieDays} onChange={set("cookieDays")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Holding Period Days</label>
                <input className={inputCls} type="number" value={form.holdingPeriodDays} onChange={set("holdingPeriodDays")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Max Commission (cents)</label>
                <input className={inputCls} type="number" value={form.maxCommission} onChange={set("maxCommission")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Min Payout (cents)</label>
                <input className={inputCls} type="number" value={form.minPayout} onChange={set("minPayout")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Recurring Duration (mo)</label>
                <input className={inputCls} type="number" value={form.recurringDuration} onChange={set("recurringDuration")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Recurring Limit</label>
                <input className={inputCls} type="number" value={form.recurringLimit} onChange={set("recurringLimit")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Tier 2 Override %</label>
                <input className={inputCls} type="number" value={form.tier2OverrideRate} onChange={set("tier2OverrideRate")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Tier 3 Override %</label>
                <input className={inputCls} type="number" value={form.tier3OverrideRate} onChange={set("tier3OverrideRate")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Max Tier Depth</label>
                <input className={inputCls} type="number" value={form.maxTierDepth} onChange={set("maxTierDepth")} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={btnPrimary} disabled={!form.name} onClick={createCampaign}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editingId && editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-bold">Edit: {editingCampaign.name}</h3>
            <EditCampaignFields
              campaign={editingCampaign}
              onSave={(fields) => updateCampaign(editingId, fields)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        </div>
      )}

      {/* Detail panel */}
      {detailId && (() => {
        const c = campaigns.find((x) => x.id === detailId);
        if (!c) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">{c.name}</h3>
                <button className={btnGhost + " !py-1 !text-xs"} onClick={() => setDetailId(null)}>Close</button>
              </div>

              {/* Commission simulator */}
              <div className="mb-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Commission Calculator</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">MRR (cents)</label>
                    <input className={inputCls + " !w-36"} type="number" value={simMrr} onChange={(e) => setSimMrr(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Country</label>
                    <input className={inputCls + " !w-20"} value={simCountry} onChange={(e) => setSimCountry(e.target.value)} />
                  </div>
                  <button className={btnPrimary + " !mb-0"} disabled={!simMrr} onClick={() => simulate(c.id)}>
                    Calculate
                  </button>
                </div>
                {simResult && (
                  <div className="mt-2 rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
                    <p>Commission: <strong>{(simResult.amount / 100).toFixed(2)}</strong> ({simResult.model})</p>
                    <p className="text-xs text-zinc-500">Based on MRR {(simResult.mrr / 100).toFixed(2)} · {simResult.country}</p>
                  </div>
                )}
              </div>

              {/* Members */}
              <div className="mb-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Members ({members.length})</p>
                {members.length === 0 ? (
                  <p className="text-xs text-zinc-400">No members assigned.</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between py-1.5">
                        <span className="min-w-0 truncate">{m.affiliateName ?? m.affiliateId}</span>
                        <span className="text-xs text-zinc-500">{m.affiliateEmail ?? ""} · {new Date(m.joinedAt).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex items-end gap-2">
                  <input className={inputCls + " !w-48"} placeholder="Affiliate ID" value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} />
                  <button className={btnPrimary + " !mb-0"} disabled={!newMemberId} onClick={() => addMember(c.id)}>Add</button>
                </div>
              </div>

              {/* Tiers */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Performance Tiers ({tiers.length})</p>
                {tiers.length === 0 ? (
                  <p className="text-xs text-zinc-400">No tiers defined.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="uppercase text-zinc-400">
                          <th className="py-1 pr-3">Tier</th>
                          <th className="py-1 pr-3">Min Customers</th>
                          <th className="py-1 pr-3">Min MRR</th>
                          <th className="py-1">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiers.map((t) => (
                          <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                            <td className="py-1 pr-3 font-medium">{t.tierName ?? t.label}</td>
                            <td className="py-1 pr-3">{t.minCustomers ?? "—"}</td>
                            <td className="py-1 pr-3">{t.minMrr ? `$${(t.minMrr / 100).toFixed(0)}` : "—"}</td>
                            <td className="py-1">{t.commissionValue ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <input className={inputCls} placeholder="Tier Name" value={tierForm.tierName} onChange={(e) => setTierForm((f) => ({ ...f, tierName: e.target.value }))} />
                  <input className={inputCls} type="number" placeholder="Min Customers" value={tierForm.minCustomers} onChange={(e) => setTierForm((f) => ({ ...f, minCustomers: e.target.value }))} />
                  <input className={inputCls} type="number" placeholder="Min MRR (cents)" value={tierForm.minMrr} onChange={(e) => setTierForm((f) => ({ ...f, minMrr: e.target.value }))} />
                  <input className={inputCls} type="number" placeholder="Commission Value" value={tierForm.commissionValue} onChange={(e) => setTierForm((f) => ({ ...f, commissionValue: e.target.value }))} />
                </div>
                <button className={btnPrimary + " mt-2"} disabled={!tierForm.tierName} onClick={() => addTier(c.id)}>
                  Add Tier
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function EditCampaignFields({
  campaign,
  onSave,
  onCancel,
}: {
  campaign: Campaign;
  onSave: (fields: Partial<Campaign>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: campaign.name,
    description: campaign.description ?? "",
    commissionModel: campaign.commissionModel,
    commissionValue: String(campaign.commissionValue),
    cookieDays: String(campaign.cookieDays),
    holdingPeriodDays: String(campaign.holdingPeriodDays),
    maxCommission: campaign.maxCommission != null ? String(campaign.maxCommission) : "",
    minPayout: String(campaign.minPayout),
    recurringDuration: campaign.recurringDuration != null ? String(campaign.recurringDuration) : "",
    recurringLimit: campaign.recurringLimit != null ? String(campaign.recurringLimit) : "",
    tier2OverrideRate: campaign.tier2OverrideRate != null ? String(campaign.tier2OverrideRate) : "",
    tier3OverrideRate: campaign.tier3OverrideRate != null ? String(campaign.tier3OverrideRate) : "",
    maxTierDepth: String(campaign.maxTierDepth),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const inputCls =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";
  const btnPrimary =
    "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700";
  const btnGhost =
    "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <input className={inputCls} value={form.name} onChange={set("name")} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium">Description</label>
          <textarea className={inputCls} rows={2} value={form.description} onChange={set("description")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Commission Model</label>
          <select className={inputCls} value={form.commissionModel} onChange={set("commissionModel")}>
            <option value="percent_mrr_12">% of MRR x12</option>
            <option value="fixed">Fixed amount</option>
            <option value="percent_first">% first payment</option>
            <option value="percent_mrr_recurring">% of MRR (recurring)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Commission Value</label>
          <input className={inputCls} type="number" value={form.commissionValue} onChange={set("commissionValue")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Cookie Days</label>
          <input className={inputCls} type="number" value={form.cookieDays} onChange={set("cookieDays")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Holding Period Days</label>
          <input className={inputCls} type="number" value={form.holdingPeriodDays} onChange={set("holdingPeriodDays")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Max Commission</label>
          <input className={inputCls} type="number" value={form.maxCommission} onChange={set("maxCommission")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Min Payout</label>
          <input className={inputCls} type="number" value={form.minPayout} onChange={set("minPayout")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Recurring Duration (mo)</label>
          <input className={inputCls} type="number" value={form.recurringDuration} onChange={set("recurringDuration")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Recurring Limit</label>
          <input className={inputCls} type="number" value={form.recurringLimit} onChange={set("recurringLimit")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Tier 2 Override %</label>
          <input className={inputCls} type="number" value={form.tier2OverrideRate} onChange={set("tier2OverrideRate")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Tier 3 Override %</label>
          <input className={inputCls} type="number" value={form.tier3OverrideRate} onChange={set("tier3OverrideRate")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Max Tier Depth</label>
          <input className={inputCls} type="number" value={form.maxTierDepth} onChange={set("maxTierDepth")} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button className={btnPrimary} onClick={() =>
          onSave({
            name: form.name,
            description: form.description,
            commissionModel: form.commissionModel,
            commissionValue: Number(form.commissionValue),
            cookieDays: Number(form.cookieDays),
            holdingPeriodDays: Number(form.holdingPeriodDays),
            maxCommission: form.maxCommission ? Number(form.maxCommission) : null,
            minPayout: Number(form.minPayout),
            recurringDuration: form.recurringDuration ? Number(form.recurringDuration) : null,
            recurringLimit: form.recurringLimit ? Number(form.recurringLimit) : null,
            tier2OverrideRate: form.tier2OverrideRate ? Number(form.tier2OverrideRate) : null,
            tier3OverrideRate: form.tier3OverrideRate ? Number(form.tier3OverrideRate) : null,
            maxTierDepth: Number(form.maxTierDepth),
          })
        }>Save</button>
      </div>
    </div>
  );
}
