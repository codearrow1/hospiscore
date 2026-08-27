"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";
import { modalFooterCls } from "@/components/ui/AccessibleModal";

export default function NewOrgModal({
  autoOpen = false,
  onCreated,
}: {
  autoOpen?: boolean;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/saas/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: form.legalName,
          businessName: form.businessName,
          country: form.country,
          website: form.website,
          acquisitionSource: form.acquisitionSource,
          acquisitionCampaign: form.acquisitionCampaign,
          primaryContact: form.contactName && form.contactEmail ? { name: form.contactName, email: form.contactEmail, phone: form.phone } : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create organization");
        return;
      }
      setOpen(false);
      router.refresh();
      onCreated?.();
      router.push(`/saas/organizations/${data.organization.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnPrimary}>+ New Organization</button>
      <Modal open={open} onClose={() => setOpen(false)} title="New SaaS Organization">
        <div className="space-y-3">
          <Field label="Legal Name" required><input className={inputCls} value={form.legalName ?? ""} onChange={set("legalName")} /></Field>
          <Field label="Business Name"><input className={inputCls} value={form.businessName ?? ""} onChange={set("businessName")} /></Field>
          <Field label="Country (ISO2)"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={set("country")} autoCapitalize="characters" /></Field>
          <Field label="Website"><input className={inputCls} type="url" inputMode="url" value={form.website ?? ""} onChange={set("website")} /></Field>
          <Field label="Acquisition Source"><input className={inputCls} value={form.acquisitionSource ?? ""} onChange={set("acquisitionSource")} placeholder="e.g. google-ads" /></Field>
          <Field label="Acquisition Campaign"><input className={inputCls} value={form.acquisitionCampaign ?? ""} onChange={set("acquisitionCampaign")} /></Field>
          <Field label="Primary Contact Name"><input className={inputCls} value={form.contactName ?? ""} onChange={set("contactName")} /></Field>
          <Field label="Contact Email"><input className={inputCls} type="email" inputMode="email" autoComplete="email" value={form.contactEmail ?? ""} onChange={set("contactEmail")} /></Field>
          <Field label="Phone"><input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" value={form.phone ?? ""} onChange={set("phone")} /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className={modalFooterCls}>
            <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy || !form.legalName} onClick={submit}>{busy ? "Creating…" : "Create"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
