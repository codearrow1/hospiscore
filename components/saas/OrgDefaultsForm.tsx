"use client";

import { useEffect, useState, useCallback } from "react";

export default function OrgDefaultsForm() {
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [initial, setInitial] = useState({ country: "", currency: "USD", timezone: "UTC" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings?category=platform");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const settings = data.settings || data;
      const c = settings.org_default_country ?? "";
      const cur = settings.org_default_currency ?? "USD";
      const tz = settings.org_default_timezone ?? "UTC";
      setCountry(c);
      setCurrency(cur);
      setTimezone(tz);
      setInitial({ country: c, currency: cur, timezone: tz });
    } catch {
      setMsg({ type: "err", text: "Failed to load defaults" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = country !== initial.country || currency !== initial.currency || timezone !== initial.timezone;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            { key: "org_default_country", value: country },
            { key: "org_default_currency", value: currency },
            { key: "org_default_timezone", value: timezone },
          ],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setInitial({ country, currency, timezone });
      setMsg({ type: "ok", text: "Defaults saved" });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Loading defaults...</div>;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium">Default Country</label>
        <p className="text-xs text-zinc-500 mb-1">Pre-selected when creating new organizations.</p>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="block w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="">(No default)</option>
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="IN">India</option>
          <option value="ZA">South Africa</option>
          <option value="AE">UAE</option>
          <option value="AU">Australia</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="SG">Singapore</option>
          <option value="JP">Japan</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Default Currency</label>
        <p className="text-xs text-zinc-500 mb-1">Billing currency for new subscriptions.</p>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="block w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="USD">USD — US Dollar</option>
          <option value="EUR">EUR — Euro</option>
          <option value="GBP">GBP — British Pound</option>
          <option value="INR">INR — Indian Rupee</option>
          <option value="ZAR">ZAR — South African Rand</option>
          <option value="AED">AED — UAE Dirham</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Default Timezone</label>
        <p className="text-xs text-zinc-500 mb-1">Timezone for date/time display in new organizations.</p>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="block w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">Eastern Time (US)</option>
          <option value="America/Los_Angeles">Pacific Time (US)</option>
          <option value="Europe/London">London (GMT)</option>
          <option value="Asia/Kolkata">India (IST)</option>
          <option value="Asia/Dubai">Dubai (GST)</option>
          <option value="Africa/Johannesburg">South Africa (SAST)</option>
          <option value="Asia/Singapore">Singapore (SGT)</option>
          <option value="Asia/Tokyo">Japan (JST)</option>
          <option value="Australia/Sydney">Australia (AEST)</option>
        </select>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save defaults"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
