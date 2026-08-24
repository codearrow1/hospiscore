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

/** Live preview — renders exactly what the public form will show, from the
 *  current draft config (updates as the builder changes). */
function FormPreview({ form }: { form: FormConfigRow }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-400">
        Live preview {!form.enabled && <span className="ml-1 font-semibold normal-case text-red-500">· disabled</span>}
      </p>
      <div className="pointer-events-none select-none space-y-3 opacity-95">
        <h3 className="text-sm font-bold">{form.name || form.slug}</h3>
        {form.fields.map((f, i) => (
          <div key={i} className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {f.label || f.name || "Field"}
              {f.required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            {f.type === "textarea" ? (
              <div className="rounded-lg border border-dashed border-zinc-300 px-2 py-1.5 text-xs text-zinc-400 dark:border-zinc-700">Multi-line input</div>
            ) : f.type === "select" ? (
              <div className="flex h-8 items-center justify-between rounded-lg border border-dashed border-zinc-300 px-2 text-xs text-zinc-400 dark:border-zinc-700">
                <span>{f.options?.[0] ?? "Choose…"}</span><span>▾</span>
              </div>
            ) : f.type === "checkbox" ? (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="h-3.5 w-3.5 rounded border border-dashed border-zinc-300 dark:border-zinc-700" /> consent checkbox</div>
            ) : (
              <div className="flex h-8 items-center rounded-lg border border-dashed border-zinc-300 px-2 text-xs text-zinc-400 dark:border-zinc-700">{f.type}</div>
            )}
          </div>
        ))}
        <button type="button" tabIndex={-1} className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white opacity-60">
          Submit
        </button>
        <p className="text-center text-[11px] italic text-zinc-400">{form.thankYou || "Thank-you message"}</p>
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 font-mono text-[10px] text-zinc-400 dark:border-zinc-800">
        POST /api/marketing/forms/{form.slug}
      </p>
    </div>
  );
}

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
              {/* Builder (left) + live preview (right) */}
              <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_300px]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
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

                  <fieldset className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <legend className="px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Fields</legend>
                    <div className="space-y-2">
                      {form.fields.map((f, i) => (
                        <div key={i} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 rounded-lg bg-zinc-50/70 p-1.5 dark:bg-zinc-950/40">
                          <input
                            className={inputCls + " !py-1 text-xs"}
                            placeholder="name"
                            aria-label={`Field ${i + 1} name`}
                            value={f.name}
                            onChange={(e) => patchField(form.slug, i, { name: e.target.value })}
                          />
                          <input
                            className={inputCls + " !py-1 text-xs"}
                            placeholder="Label"
                            aria-label={`Field ${i + 1} label`}
                            value={f.label}
                            onChange={(e) => patchField(form.slug, i, { label: e.target.value })}
                          />
                          <div className="flex items-center gap-1.5">
                            <select
                              className={inputCls + " !w-auto !py-1 text-xs"}
                              aria-label={`Field ${i + 1} type`}
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
                            <button onClick={() => removeField(form.slug, i)} className="px-0.5 text-xs text-zinc-400 hover:text-rose-500" aria-label={`Remove ${f.label}`}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addField(form.slug)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                      + Add field
                    </button>
                  </fieldset>
                </div>

                <div className="lg:sticky lg:top-4">
                  <FormPreview form={form} />
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