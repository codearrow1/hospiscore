"use client";

import { useState, useEffect, useCallback } from "react";

interface SettingValue {
  key: string;
  value: unknown;
  type: string;
  description: string;
  category: string;
  defaultValue: unknown;
  min?: number;
  max?: number;
  options?: string[];
}

function JsonEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (raw: string) => {
    setText(raw);
    try {
      const parsed = JSON.parse(raw);
      setError(null);
      onChange(parsed);
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div className="w-72">
      <textarea
        value={text}
        rows={4}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full rounded-lg border bg-white px-3 py-2 font-mono text-xs dark:bg-zinc-800 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500"
        } dark:border-zinc-700`}
        spellCheck={false}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function SettingsPanel({ category }: { category: string }) {
  const [settings, setSettings] = useState<SettingValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings?category=${category}`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings ?? []);
        const initial: Record<string, unknown> = {};
        for (const s of data.settings ?? []) {
          initial[s.key] = s.value;
        }
        setEditValues(initial);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const updates = settings
        .filter((s) => JSON.stringify(editValues[s.key]) !== JSON.stringify(s.value))
        .map((s) => ({ key: s.key, value: editValues[s.key] }));

      if (updates.length === 0) {
        setFeedback({ type: "success", text: "No changes to save" });
        setSaving(false);
        return;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings");
      }

      setFeedback({ type: "success", text: `${updates.length} setting(s) saved` });
      fetchSettings();
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings.some(
    (s) => JSON.stringify(editValues[s.key]) !== JSON.stringify(s.value),
  );

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading settings...</div>;
  }

  if (settings.length === 0) {
    return <div className="text-sm text-zinc-500">No settings in this category.</div>;
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {settings.map((s) => (
            <div key={s.key} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <label className="block text-sm font-medium">{s.key}</label>
                  <p className="mt-0.5 text-xs text-zinc-500">{s.description}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Default: <code>{JSON.stringify(s.defaultValue)}</code>
                  </p>
                </div>
                <div className="shrink-0">
                  {s.type === "boolean" ? (
                    <button
                      role="switch"
                      aria-checked={!!editValues[s.key]}
                      onClick={() => setEditValues((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        editValues[s.key] ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          editValues[s.key] ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  ) : s.type === "json" ? (
                    <JsonEditor
                      value={editValues[s.key]}
                      onChange={(v) => setEditValues((prev) => ({ ...prev, [s.key]: v }))}
                    />
                  ) : s.options ? (
                    <select
                      value={String(editValues[s.key] ?? "")}
                      onChange={(e) =>
                        setEditValues((prev) => {
                          const val = s.type === "number" ? Number(e.target.value) : e.target.value;
                          return { ...prev, [s.key]: val };
                        })
                      }
                      className="w-48 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      {s.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : s.type === "number" ? (
                    <input
                      type="number"
                      value={Number(editValues[s.key] ?? 0)}
                      min={s.min}
                      max={s.max}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))
                      }
                      className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-right dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  ) : (
                    <input
                      type={s.type === "secret" ? "password" : "text"}
                      value={String(editValues[s.key] ?? "")}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [s.key]: e.target.value }))
                      }
                      className="w-48 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
