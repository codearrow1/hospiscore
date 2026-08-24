"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  audience?: string;
  country?: string;
  landingPage?: string;
  utmCampaign?: string;
  startAt?: string;
  endAt?: string;
  budget?: number;
  status: string;
  leads: number;
  demos: number;
  trials: number;
  conversions: number;
  pipelineValue: number;
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  paused: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ended: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function CampaignsManager({
  campaigns,
}: {
  campaigns: CampaignRow[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<CampaignRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const total = useMemo(
    () => ({
      leads: campaigns.reduce((s, c) => s + c.leads, 0),
      pipeline: campaigns.reduce((s, c) => s + c.pipelineValue, 0),
      conversions: campaigns.reduce((s, c) => s + c.conversions, 0),
    }),
    [campaigns],
  );

  const create = async () => {
    setBusy(true);
    setStatus("");
    const res = await fetch("/api/marketing/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        channel: form.channel || "other",
        audience: form.audience || undefined,
        country: form.country || undefined,
        landingPage: form.landingPage || undefined,
        utmCampaign: form.utmCampaign || undefined,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        status: "draft",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Could not create campaign");
      return;
    }
    setShowNew(false);
    setStatus("Campaign created.");
    router.refresh();
  };

  const setStatusAndPatch = async (id: string, patch: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/marketing/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Update failed");
      return;
    }
    setStatus("Campaign updated.");
    router.refresh();
  };

  const del = async (id: string) => {
    setBusy(true);
    const res = await fetch(`/api/marketing/campaigns/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setStatus((await res.json().catch(() => ({}))).error ?? "Delete failed");
      return;
    }
    setDeleting(null);
    setStatus("Campaign deleted.");
    router.refresh();
  };

  const statusMenu = (c: CampaignRow) => (
    <select
      value={c.status}
      disabled={busy}
      onChange={(e) => setStatusAndPatch(c.id, { status: e.target.value })}
      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      aria-label={`Status for ${c.name}`}
    >
      {["draft", "active", "paused", "ended"].map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-5">
      {status && (
        <p role="status" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {status}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Campaigns" value={campaigns.length} />
        <SummaryTile label="Attributed leads" value={total.leads} />
        <SummaryTile label="Converted" value={total.conversions} accent />
        <SummaryTile label="Pipeline value" value={total.pipeline > 0 ? `$${total.pipeline.toLocaleString()}` : "—"} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Attribution is computed from real UTM campaign / landing-page data captured on leads.
        </p>
        <button className={btnPrimary} onClick={() => setShowNew(true)}>New campaign</button>
      </div>

      {campaigns.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
          No campaigns yet. Create one, then add <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">?utm_campaign=…</code> to your links.
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {c.channel} · {c.utmCampaign ? `utm_campaign=${c.utmCampaign}` : "no UTM tag"} · {c.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusMenu(c)}
                  <button onClick={() => setDeleting(c)} className="text-xs text-zinc-400 transition hover:text-rose-500">
                    Delete
                  </button>
                </div>
              </div>
              {c.audience || c.country || c.landingPage ? (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {[c.audience, c.country, c.landingPage].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <Metric label="Leads" value={c.leads} />
                <Metric label="Demos" value={c.demos} />
                <Metric label="Trials" value={c.trials} />
                <Metric label="Converted" value={c.conversions} />
                <Metric label="Pipeline" value={c.pipelineValue > 0 ? `$${c.pipelineValue.toLocaleString()}` : "—"} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New campaign">
        <div className="space-y-3">
          <Field label="Name" required><input className={inputCls} value={form.name ?? ""} onChange={set("name")} placeholder="Q4 hotelier summit" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Channel" required>
              <select className={inputCls} value={form.channel ?? "google_ads"} onChange={set("channel")}>
                {["google_ads", "meta_ads", "linkedin", "youtube", "email", "referral", "partner", "other"].map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Country (2-letter)"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={set("country")} /></Field>
          </div>
          <Field label="UTM campaign token"><input className={inputCls} value={form.utmCampaign ?? ""} onChange={set("utmCampaign")} placeholder="q4-hotelier-summit" /></Field>
          <Field label="Landing page prefix"><input className={inputCls} value={form.landingPage ?? ""} onChange={set("landingPage")} placeholder="/platform/" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start"><input className={inputCls} type="date" value={form.startAt ?? ""} onChange={set("startAt")} /></Field>
            <Field label="End"><input className={inputCls} type="date" value={form.endAt ?? ""} onChange={set("endAt")} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Budget (USD)"><input className={inputCls} type="number" min={0} value={form.budget ?? ""} onChange={set("budget")} /></Field>
            <Field label="Audience"><input className={inputCls} value={form.audience ?? ""} onChange={set("audience")} /></Field>
          </div>
          {status && <p className="text-sm text-red-500">{status}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setShowNew(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy} onClick={create}>{busy ? "Creating…" : "Create campaign"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        action={deleting
          ? {
              title: "Delete campaign",
              message: `Delete "${deleting.name}"?`,
              consequences: [
                "The campaign configuration is permanently removed.",
                "Lead history and attribution records are kept.",
                "This action cannot be undone.",
              ],
              confirmLabel: "Delete",
              tone: "danger",
            }
          : null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del(deleting.id)}
      />
    </div>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

export { Badge, STATUS_TONE };