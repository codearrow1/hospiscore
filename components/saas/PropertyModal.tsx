"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";

export default function PropertyModal({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/saas/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, name: form.name, city: form.city, country: form.country, rooms: form.rooms ? Number(form.rooms) : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create property");
        return;
      }
      setOpen(false);
      setForm({});
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnPrimary}>+ Add Property</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Property (Tenant)">
        <div className="space-y-3">
          <Field label="Property Name" required><input className={inputCls} value={form.name ?? ""} onChange={set("name")} placeholder="Grand Plaza Hotel" /></Field>
          <Field label="City"><input className={inputCls} value={form.city ?? ""} onChange={set("city")} /></Field>
          <Field label="Country (ISO2)"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={set("country")} /></Field>
          <Field label="Rooms"><input className={inputCls} type="number" value={form.rooms ?? ""} onChange={set("rooms")} /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy || !form.name} onClick={submit}>{busy ? "Creating…" : "Create"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
