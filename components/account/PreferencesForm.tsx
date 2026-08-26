"use client";

import { useEffect, useState, useCallback } from "react";
import { TIMEZONES, DATE_FORMATS, type UserPreferences } from "@/lib/userPreferences.constants";

export default function PreferencesForm() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/preferences");
      if (!res.ok) throw new Error("Failed to load");
      const data: UserPreferences = await res.json();
      setPrefs(data);
      setTimezone(data.timezone);
      setDateFormat(data.dateFormat);
    } catch {
      setMsg({ type: "err", text: "Failed to load preferences" });
    }
  }, []);

  useEffect(() => {
    load();
    const stored = localStorage.getItem("hs-theme") as "light" | "dark" | "system" | null;
    setTheme(stored ?? "system");
  }, [load]);

  function applyTheme(next: "light" | "dark" | "system") {
    setTheme(next);
    localStorage.setItem("hs-theme", next);
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
    } else if (next === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, dateFormat }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      const data: UserPreferences = await res.json();
      setPrefs(data);
      setMsg({ type: "ok", text: "Preferences saved" });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const dirty = prefs && (prefs.timezone !== timezone || prefs.dateFormat !== dateFormat);

  if (!prefs) {
    return <div className="text-sm text-zinc-500">Loading preferences...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <section>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose how HospiOS looks on this device.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 max-w-md">
          {(["light", "dark", "system"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => applyTheme(opt)}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                theme === opt
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Timezone */}
      <section>
        <h2 className="text-lg font-semibold">Timezone</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Used for displaying dates and times throughout the app.
        </p>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-3 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </section>

      {/* Date Format */}
      <section>
        <h2 className="text-lg font-semibold">Date Format</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          How dates are displayed in lists and reports.
        </p>
        <div className="mt-3 space-y-2 max-w-md">
          {DATE_FORMATS.map((f) => (
            <label
              key={f.value}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                dateFormat === f.value
                  ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="dateFormat"
                value={f.value}
                checked={dateFormat === f.value}
                onChange={(e) => setDateFormat(e.target.value)}
                className="accent-indigo-600"
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save preferences"}
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
