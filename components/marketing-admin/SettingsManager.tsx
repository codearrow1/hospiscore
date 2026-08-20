"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionCard } from "./ui";

export interface TeamRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
}

export default function SettingsManager({
  users,
  roles,
  config,
}: {
  users: TeamRow[];
  roles: { id: string; label: string }[];
  config: Record<string, string>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const setRole = async (id: string, email: string, role: string) => {
    setBusy(true);
    setStatus("");
    const res = await fetch(`/api/marketing/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: role || null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Update failed");
      return;
    }
    setStatus(`${email} → ${role || "no marketing role"}.`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {status && (
        <p role="status" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {status}
        </p>
      )}

      <SectionCard title="Team & roles">
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Assign marketing roles to accounts. Users without a role can still
          enter via the legacy{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">ADMIN_EMAILS</code>{" "}
          allowlist, which maps to Super Admin.
        </p>
        {users.length === 0 ? (
          <p className="text-sm text-zinc-400">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="pb-2 pr-3 font-semibold">User</th>
                  <th className="pb-2 pr-3 font-semibold">Email</th>
                  <th className="pb-2 font-semibold">Marketing role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="py-2.5 pr-3 font-medium">{u.name || "—"}</td>
                    <td className="py-2.5 pr-3 text-zinc-500">{u.email}</td>
                    <td className="py-2.5">
                      <select
                        value={u.role ?? ""}
                        disabled={busy}
                        onChange={(e) => setRole(u.id, u.email, e.target.value)}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        aria-label={`Role for ${u.email}`}
                      >
                        <option value="">No role</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Environment & notifications">
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(config).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{k}</dt>
              <dd className="mt-0.5 truncate font-mono text-sm text-zinc-700 dark:text-zinc-200">{v}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="Demo data">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Development only: run{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">npm run seed:marketing-demo</code>{" "}
          to create demo accounts for every role. The seeder refuses to run in
          production unless <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">ALLOW_DEMO_SEED=1</code> is set.
        </p>
      </SectionCard>
    </div>
  );
}