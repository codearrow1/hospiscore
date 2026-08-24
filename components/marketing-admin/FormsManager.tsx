"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, SectionCard } from "./ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface FormConfigRow {
  slug: string;
  name: string;
  source: string;
  fields: { name: string; label: string; type?: string; required?: boolean; options?: string[] }[];
  destination: string;
  notifyEmails?: string[];
  autoReplySubject?: string;
  autoReplyBody?: string;
  consentRequired?: boolean;
  thankYou: string;
  redirectUrl?: string;
  slim?: boolean;
  enabled: boolean;
}

const DESTINATIONS = ["lead", "email", "lead_and_email", "none"];
const SOURCES = [
  "organic", "google_ads", "meta_ads", "linkedin", "youtube", "direct",
  "referral", "partner", "email", "whatsapp", "blog", "pricing_page",
  "feature_page", "demo_page", "country_page", "campaign", "other",
];
const FIELD_TYPES = ["text", "email", "tel", "number", "textarea", "select", "checkbox"];

export default function FormsManager({ forms }: { forms: FormConfigRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<FormConfigRow[]>(() => structuredClone(forms));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [open, setOpen] = useState<string | null>(rows[0]?.slug ?? null);

  const patch = (slug: string, p: Partial<FormConfigRow>) =>
    setRows((rs) => rs.map((r) => (r.slug === slug ? { ...r, ...p } : r)));

  const patchField = (slug: string, index: number, p: Partial<FormConfigRow["fields"][number]>) =>
    setRows((rs) =>
      rs.map((r) =>
        r.slug === slug
          ? { ...r, fields: r.fields.map((f, i) => (i === index ? { ...f, ...p } : f)) }
          : r,
      ),
    );

  const addField = (slug: string) =>
    setRows((rs) =>
      rs.map((r) =>
        r.slug === slug ? { ...r, fields: [...r.fields, { name: "", label: "New field" }] } : r,
      ),
    );

  const removeField = (slug: string, index: number) =>
    setRows((rs) =>
      rs.map((r) => (r.slug === slug ? { ...r, fields: r.fields.filter((_, i) => i !== index) } : r)),
    );

  const save = async () => {
    setBusy(true);
    setStatus("");
    const res = await fetch("/api/marketing/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forms: rows }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Save failed");
      return;
    }
    setStatus("Form configs saved.");
    router.refresh();
  };

  const reset = async () => {
    setBusy(true);
    setStatus("");
    const res = await fetch("/api/marketing/forms", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Reset failed");
      return;
    }
    setConfirmReset(false);
    setStatus("Forms reset to defaults.");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {status && (
        <p role="status" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {status}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Each public form submits to the marketing pipeline. Changes apply to new submissions only.
        </p>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => setConfirmReset(true)} disabled={busy}>Reset to defaults</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save all changes"}
          </button>
        </div>
      </div>

      {rows.map((form) => {
        const isOpen = open === form.slug;
        return (
          <SectionCard
            key={form.slug}
            title={form.name || form.slug}
            action={
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => patch(form.slug, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-indigo-600"
                />
                enabled
              </label>
            }
          >
            <details open={isOpen} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open ? form.slug : null)}>
              <summary className="cursor-pointer list-none">
                <span className="font-mono text-xs text-zinc-400">/api/marketing/forms/{form.slug}</span>
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Slug"><input className={inputCls} value={form.slug} disabled /></Field>
                  <Field label="Form name">
                    <input className={inputCls} value={form.name} onChange={(e) => patch(form.slug, { name: e.target.value })} />
                  </Field>
                  <Field label="Source">
                    <select className={inputCls} value={form.source} onChange={(e) => patch(form.slug, { source: e.target.value })}>
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Destination">
                    <select className={inputCls} value={form.destination} onChange={(e) => patch(form.slug, { destination: e.target.value })}>
                      {DESTINATIONS.map((d) => (
                        <option key={d} value={d}>{d.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Notification emails (comma separated)">
                  <input
                    className={inputCls}
                    value={(form.notifyEmails ?? []).join(", ")}
                    onChange={(e) =>
                      patch(form.slug, { notifyEmails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                    }
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Auto-reply subject">
                    <input className={inputCls} value={form.autoReplySubject ?? ""} onChange={(e) => patch(form.slug, { autoReplySubject: e.target.value })} />
                  </Field>
                  <Field label="Thank-you message">
                    <input className={inputCls} value={form.thankYou} onChange={(e) => patch(form.slug, { thankYou: e.target.value })} />
                  </Field>
                </div>
                <Field label="Auto-reply body ({{name}}, {{message}} are filled in)">
                  <textarea className={inputCls} rows={3} value={form.autoReplyBody ?? ""} onChange={(e) => patch(form.slug, { autoReplyBody: e.target.value })} />
                </Field>
                <Field label="Redirect URL (optional)">
                  <input className={inputCls} value={form.redirectUrl ?? ""} onChange={(e) => patch(form.slug, { redirectUrl: e.target.value || undefined })} placeholder="/thanks" />
                </Field>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Fields</p>
                    <button onClick={() => addField(form.slug)} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                      + Add field
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.fields.map((f, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input
                          className={inputCls + " !w-36"}
                          placeholder="name"
                          value={f.name}
                          onChange={(e) => patchField(form.slug, i, { name: e.target.value })}
                        />
                        <input
                          className={inputCls + " min-w-40 flex-1"}
                          placeholder="Label"
                          value={f.label}
                          onChange={(e) => patchField(form.slug, i, { label: e.target.value })}
                        />
                        <select
                          className={inputCls + " !w-auto"}
                          value={f.type ?? "text"}
                          onChange={(e) => patchField(form.slug, i, { type: e.target.value })}
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-zinc-500">
                          <input
                            type="checkbox"
                            checked={Boolean(f.required)}
                            onChange={(e) => patchField(form.slug, i, { required: e.target.checked })}
                            className="h-3.5 w-3.5 accent-indigo-600"
                          />
                          req
                        </label>
                        <button onClick={() => removeField(form.slug, i)} className="text-xs text-zinc-400 hover:text-rose-500" aria-label={`Remove ${f.label}`}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </SectionCard>
        );
      })}

      <ConfirmDialog
        action={confirmReset
          ? {
              title: "Reset all forms",
              message: "Reset every form configuration to the built-in defaults?",
              consequences: [
                "All custom fields, destinations, and auto-reply copy are discarded.",
                "Live website forms fall back to the default schema immediately.",
                "This action cannot be undone.",
              ],
              confirmLabel: "Reset forms",
              tone: "danger",
            }
          : null}
        onClose={() => setConfirmReset(false)}
        onConfirm={reset}
        busy={busy}
      />
    </div>
  );
}