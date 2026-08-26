"use client";

import { useEffect, useState, useCallback } from "react";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string;
}

const SAAS_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  platform_admin: "Platform Admin",
  finance_admin: "Finance Admin",
  marketing_admin: "Marketing Admin",
  sales_admin: "Sales Admin",
  customer_success: "Customer Success",
  support_admin: "Support Admin",
  affiliate_manager: "Affiliate Manager",
  partner_manager: "Partner Manager",
  franchise_manager: "Franchise Manager",
  analyst: "Analyst",
  read_only: "Read Only",
};

export default function TeamManager() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/saas/users");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setUsers(data.users);
      setRoles(data.roles);
    } catch {
      setMsg({ type: "err", text: "Failed to load users" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(u: TeamUser) {
    setEditingId(u.id);
    setEditRole(u.role || "");
    setMsg(null);
  }

  async function saveRole(userId: string) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/saas/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: editRole || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      const updated: TeamUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setEditingId(null);
      setMsg({ type: "ok", text: `Role updated for ${updated.name || updated.email}` });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter((u) =>
    !filter || u.name?.toLowerCase().includes(filter.toLowerCase()) || u.email.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="text-sm text-zinc-500">Loading team members...</div>;

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or email..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No team members found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-4 py-3 font-medium">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800"
                      >
                        <option value="">No role</option>
                        {roles.filter((r) => !r.includes("_manager") || r === "affiliate_manager" || r === "partner_manager" || r === "franchise_manager").map((r) => (
                          <option key={r} value={r}>{SAAS_ROLE_LABELS[r] || r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {u.role ? SAAS_ROLE_LABELS[u.role] || u.role : "No role"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveRole(u.id)}
                          disabled={saving}
                          className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {saving ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(u)}
                        className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
                      >
                        Edit Role
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Feedback */}
      {msg && (
        <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
