"use client";

import { useState, useEffect } from "react";

interface NotificationPreference {
  kind: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreference[] = [
  { kind: "ticket.created", email: true, push: false, inApp: true },
  { kind: "ticket.replied", email: true, push: false, inApp: true },
  { kind: "subscription.renewed", email: false, push: false, inApp: true },
  { kind: "dunning.alert", email: true, push: true, inApp: true },
  { kind: "invoice.issued", email: true, push: false, inApp: true },
  { kind: "payout.approved", email: true, push: false, inApp: true },
  { kind: "commission.earned", email: false, push: false, inApp: true },
  { kind: "fraud.flagged", email: true, push: true, inApp: true },
  { kind: "campaign.joined", email: false, push: false, inApp: true },
  { kind: "terms.updated", email: true, push: false, inApp: true },
];

const KIND_LABELS: Record<string, string> = {
  "ticket.created": "New support ticket",
  "ticket.replied": "Support ticket reply",
  "subscription.renewed": "Subscription renewed",
  "dunning.alert": "Payment overdue",
  "invoice.issued": "New invoice",
  "payout.approved": "Payout approved",
  "commission.earned": "Commission earned",
  "fraud.flagged": "Fraud alert",
  "campaign.joined": "Campaign joined",
  "terms.updated": "Terms updated",
};

interface NotificationsFormProps {
  userId: string;
}

export default function NotificationsForm({ userId: _userId }: NotificationsFormProps) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/account/notifications");
        if (res.ok) {
          const data = await res.json();
          if (data.preferences && Array.isArray(data.preferences)) {
            setPreferences(data.preferences);
          }
        }
      } catch {
        // Use defaults
      }
    }
    fetchPreferences();
  }, []);

  const updatePreference = (kind: string, channel: "email" | "push" | "inApp", value: boolean) => {
    setPreferences(prev =>
      prev.map(p =>
        p.kind === kind ? { ...p, [channel]: value } : p
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update preferences");
      }

      setFeedback({ type: "success", text: "Notification preferences saved" });
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Failed to save preferences" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Notification Channels</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose which notifications you receive and how.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="pb-3 pr-4 font-semibold">Event</th>
                <th className="pb-3 px-4 text-center font-semibold">Email</th>
                <th className="pb-3 px-4 text-center font-semibold">Push</th>
                <th className="pb-3 pl-4 text-center font-semibold">In-App</th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((pref) => (
                <tr key={pref.kind} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-3 pr-4 font-medium">{KIND_LABELS[pref.kind] || pref.kind}</td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={pref.email}
                      onChange={(e) => updatePreference(pref.kind, "email", e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={pref.push}
                      onChange={(e) => updatePreference(pref.kind, "push", e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="py-3 pl-4 text-center">
                    <input
                      type="checkbox"
                      checked={pref.inApp}
                      onChange={(e) => updatePreference(pref.kind, "inApp", e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
