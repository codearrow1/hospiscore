"use client";

/**
 * AuditFilterBar — GET-filter controls collapsed into a FilterSheet.
 * Navigates to /saas/audit?action=…&targetType=… preserving shareable URLs.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, inputCls, btnPrimary } from "@/components/marketing-admin/ui";
import { FilterSheet } from "@/components/ui/FilterSheet";

export default function AuditFilterBar({ action, targetType }: { action: string; targetType: string }) {
  const router = useRouter();
  const [a, setA] = useState(action);
  const [t, setT] = useState(targetType);
  const activeCount = (action ? 1 : 0) + (targetType ? 1 : 0);

  const apply = () => {
    const params = new URLSearchParams();
    if (a.trim()) params.set("action", a.trim());
    if (t.trim()) params.set("targetType", t.trim());
    router.push(`/saas/audit${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSheet
        label="Filters"
        activeCount={activeCount}
        onClearAll={() => { setA(""); setT(""); router.push("/saas/audit"); }}
        footerExtra={
          <button type="button" onClick={apply} className={btnPrimary}>
            Apply
          </button>
        }
      >
        <Field label="Action">
          <input className={inputCls} value={a} onChange={(e) => setA(e.target.value)} placeholder="e.g. org.created" />
        </Field>
        <Field label="Target type">
          <input className={inputCls} value={t} onChange={(e) => setT(e.target.value)} placeholder="e.g. subscription" />
        </Field>
      </FilterSheet>
      {activeCount > 0 && (
        <span className="text-xs text-zinc-500">
          {action && <span className="me-1 rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] dark:bg-zinc-800">{action}</span>}
          {targetType && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] dark:bg-zinc-800">{targetType}</span>}
        </span>
      )}
    </div>
  );
}
