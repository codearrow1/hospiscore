"use client";

import { useEffect, useState } from "react";

interface Setting {
  id: string;
  key: string;
  value: string;
  updatedAt?: string;
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";
const btnPrimary =
  "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

const RECOMMENDED = [
  { key: "holding_period_days", value: "30", description: "Days before commissions become eligible" },
  { key: "min_payout_cents", value: "5000", description: "Minimum payout threshold (cents)" },
  { key: "cookie_duration_days", value: "30", description: "Attribution cookie window" },
  { key: "fraud_threshold", value: "60", description: "Auto-flag risk scores above this" },
  { key: "max_tier_depth", value: "3", description: "Maximum multi-tier levels" },
  { key: "commission_model", value: "percent_mrr", description: "Default commission model for new affiliates" },
];

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saas/affiliate-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings ?? data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const upsertSetting = async () => {
    const res = await fetch("/api/saas/affiliate-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: formKey, value: formValue }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed to save setting");
      return;
    }
    setShowForm(false);
    setFormKey("");
    setFormValue("");
    fetchSettings();
  };

  const saveEdit = async (id: string, key: string) => {
    const res = await fetch("/api/saas/affiliate-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: editValue }),
    });
    if (!res.ok) {
      alert("Failed to update setting");
      return;
    }
    setEditingId(null);
    setEditValue("");
    fetchSettings();
  };

  const populateRecommended = (rec: { key: string; value: string }) => {
    setFormKey(rec.key);
    setFormValue(rec.value);
    setShowForm(true);
  };

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading settings…</div>;
  }

  const settingsMap = new Map(settings.map((s) => [s.key, s]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Affiliate Program Settings</h2>
        <button onClick={() => setShowForm(true)} className={btnPrimary + " ml-auto"}>
          + Add Setting
        </button>
      </div>

      {/* Recommended settings quick-add */}
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Recommended Settings</p>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDED.map((rec) => {
            const existing = settingsMap.get(rec.key);
            return (
              <button
                key={rec.key}
                onClick={() => populateRecommended(rec)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  existing
                    ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
                title={rec.description}
              >
                {rec.key} {existing ? "✓" : "+"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings table */}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="hidden w-full text-left text-sm md:table">
          <thead>
            <tr className="text-xs uppercase text-zinc-400">
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs font-medium">{s.key}</span>
                </td>
                <td className="px-3 py-2">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2">
                      <input className={inputCls + " !w-48"} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                      <button className={btnPrimary + " !py-1 !text-xs"} onClick={() => saveEdit(s.id, s.key)}>Save</button>
                      <button className={btnGhost + " !py-1 !text-xs"} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <span className="font-mono text-xs">{s.value}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2">
                  {editingId !== s.id && (
                    <button
                      className={btnGhost + " !py-1 !text-xs"}
                      onClick={() => { setEditingId(s.id); setEditValue(s.value); }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {settings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-400">
                  No settings configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile list */}
        <ul className="divide-y md:hidden">
          {settings.map((s) => (
            <li key={s.id} className="space-y-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-medium">{s.key}</span>
                <button
                  className={btnGhost + " !py-0.5 !text-xs"}
                  onClick={() => { setEditingId(s.id); setEditValue(s.value); }}
                >
                  Edit
                </button>
              </div>
              {editingId === s.id ? (
                <div className="flex items-center gap-2">
                  <input className={inputCls + " !flex-1"} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                  <button className={btnPrimary + " !py-1 !text-xs"} onClick={() => saveEdit(s.id, s.key)}>Save</button>
                </div>
              ) : (
                <p className="font-mono text-xs text-zinc-500">{s.value}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Create / upsert form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-bold">Add / Update Setting</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Key</label>
                <input
                  className={inputCls}
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. holding_period_days"
                />
                <p className="mt-1 text-[11px] text-zinc-400">Existing keys will be updated, new ones created.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Value</label>
                <input className={inputCls} value={formValue} onChange={(e) => setFormValue(e.target.value)} />
              </div>
              {formKey && (
                <p className="text-xs text-zinc-500">
                  {RECOMMENDED.find((r) => r.key === formKey)?.description}
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => { setShowForm(false); setFormKey(""); setFormValue(""); }}>
                Cancel
              </button>
              <button className={btnPrimary} disabled={!formKey} onClick={upsertSetting}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
