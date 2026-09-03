"use client";

/**
 * OnboardingChecklist — role-specific setup checklist for the portals.
 * State comes from GET /api/portals/onboarding (auto steps derived from real
 * backend state + manual marks persisted in OnboardingProgress). Local UI
 * state is only a cache of that endpoint — never the source of truth.
 */
import { useCallback, useEffect, useState } from "react";
import { btnGhost, SectionCard } from "@/components/marketing-admin/ui";

interface Step {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  source: "auto" | "manual";
}

export default function OnboardingChecklist({ title = "Getting started" }: { title?: string }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portals/onboarding");
      if (!res.ok) {
        setSteps([]);
        return;
      }
      const d = await res.json();
      setSteps(d.steps ?? []);
    } catch {
      setSteps([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (stepKey: string) => {
    setBusyKey(stepKey);
    setError("");
    try {
      const res = await fetch("/api/portals/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepKey }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Could not save");
        return;
      }
      setSteps(d.steps ?? []);
    } finally {
      setBusyKey("");
    }
  };

  if (steps === null) {
    return (
      <SectionCard title={title}>
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </SectionCard>
    );
  }
  if (steps.length === 0) return null;

  const remaining = steps.filter((s) => !s.done).length;
  const heading = remaining > 0 ? title + " - " + remaining + (remaining === 1 ? " step" : " steps") + " left" : title + " - all set";

  return (
    <SectionCard title={heading}>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const dotCls = s.done
            ? "bg-emerald-500 text-white"
            : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400";
          return (
          <li key={s.key} className="flex items-start gap-2.5">
            <span
              className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold " + dotCls}
              aria-hidden
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={"text-sm " + (s.done ? "text-zinc-400 line-through dark:text-zinc-500" : "font-medium")}>{s.label}</span>
              {!s.done && <span className="block text-xs text-zinc-500">{s.hint}</span>}
            </span>
            {s.source === "manual" && !s.done && (
              <button onClick={() => mark(s.key)} disabled={busyKey === s.key} className={btnGhost + " !py-1 !text-xs"}>
                {busyKey === s.key ? "Saving…" : "Mark done"}
              </button>
            )}
          </li>
          );
        })}
      </ol>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </SectionCard>
  );
}
