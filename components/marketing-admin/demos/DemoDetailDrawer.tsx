"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DetailDrawer,
  DrawerSection,
  KeyValue,
} from "@/components/ui/DetailDrawer";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Field, Select, inputCls } from "@/components/ui/index";
import { Timeline, type TimelineEntry } from "@/components/ui/Timeline";
import { STAGE_LABELS, STAGE_STYLES } from "@/lib/marketing/stages";
import { DEMO_STATUSES, type LeadEvent } from "@/lib/marketing/types";
import { demoNeedsFollowUp, type DemoRow } from "@/lib/marketing/demosView";
import { formatMoney, formatRelative } from "@/lib/format";
import { dateTimeOf, timeOf } from "./demoUi";

export function DemoDetailDrawer({
  demo,
  team,
  eventsByLead,
  tzLabel,
  onPatch,
  onClose,
}: {
  demo: DemoRow | null;
  team: { id: string; name: string; email: string }[];
  eventsByLead: Record<string, LeadEvent[]>;
  tzLabel: string;
  onPatch: (id: string, changes: Record<string, string | number | undefined>) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{ demoType: string; meetingUrl: string; phone: string; notes: string }>({
    demoType: "",
    meetingUrl: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (demo) {
      setEdit({
        demoType: demo.demoType ?? "",
        meetingUrl: demo.meetingUrl ?? "",
        phone: demo.phone ?? "",
        notes: demo.notes ?? "",
      });
      setSaving(false);
    }
  }, [demo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!demo) return null;

  const patch = async (changes: Record<string, string | number | undefined>) => {
    setSaving(true);
    onPatch(demo.id, changes);
  };

  const needsFollowUp = demoNeedsFollowUp(demo, new Date());
  const events: TimelineEntry[] = (eventsByLead[demo.leadId] ?? []).map((e) => ({
    id: e.id,
    at: e.at,
    title: e.summary,
    body: e.detail,
    meta: e.byEmail ? e.byEmail : undefined,
  }));

  const dirty =
    (demo.demoType ?? "") !== edit.demoType ||
    (demo.meetingUrl ?? "") !== edit.meetingUrl ||
    (demo.phone ?? "") !== edit.phone ||
    (demo.notes ?? "") !== edit.notes;

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={demo.leadName}
      subtitle={`${dateTimeOf(demo.startAt)} · ${demo.durationMin} min${tzLabel ? ` · ${tzLabel}` : ""}`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/marketing-admin/leads/${demo.leadId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-surface-subtle md:min-h-9 dark:text-zinc-200"
          >
            Open lead →
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-surface-subtle md:min-h-9 dark:text-zinc-300"
              onClick={onClose}
            >
              Close
            </button>
            {dirty && (
              <button
                type="button"
                disabled={saving}
                onClick={() => patch({ demoType: edit.demoType || undefined, meetingUrl: edit.meetingUrl || undefined, phone: edit.phone || undefined, notes: edit.notes || undefined })}
                className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 md:min-h-9"
              >
                {saving ? "Saving…" : "Save edits"}
              </button>
            )}
          </div>
        </div>
      }
    >
      <DrawerSection title="Demo">
        <div className="space-y-3">
          {needsFollowUp && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              This demo needs a follow-up.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <Select
                value={demo.status}
                disabled={saving}
                onChange={(e) => patch({ status: e.target.value })}
                className="w-full"
              >
                {DEMO_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </Field>
            <Field label="Assignee">
              <Select
                value={demo.assignedTo ?? ""}
                disabled={saving}
                onChange={(e) => patch({ assignedTo: e.target.value || undefined })}
                className="w-full"
              >
                <option value="">Unassigned</option>
                {team.map((t) => (
                  <option key={t.id} value={t.email}>{t.name || t.email}</option>
                ))}
              </Select>
            </Field>
            <Field label="Demo type">
              <input
                className={inputCls}
                value={edit.demoType}
                disabled={saving}
                onChange={(e) => setEdit((s) => ({ ...s, demoType: e.target.value }))}
                placeholder="e.g. Product walkthrough"
              />
            </Field>
            <Field label="Meeting URL">
              <input
                className={inputCls}
                value={edit.meetingUrl}
                disabled={saving}
                onChange={(e) => setEdit((s) => ({ ...s, meetingUrl: e.target.value }))}
                placeholder="https://meet…"
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputCls}
                value={edit.phone}
                disabled={saving}
                onChange={(e) => setEdit((s) => ({ ...s, phone: e.target.value }))}
              />
            </Field>
            <Field label="Location">
              <p className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                {[demo.city, demo.country].filter(Boolean).join(", ") || "—"}
              </p>
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              className={inputCls}
              rows={3}
              value={edit.notes}
              disabled={saving}
              onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))}
            />
          </Field>
          {demo.meetingUrl && (
            <a href={demo.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Join meeting ↗
            </a>
          )}
        </div>
      </DrawerSection>

      <DrawerSection title="Lead context">
        <dl>
          <KeyValue label="Contact">
            <a href={`mailto:${demo.leadEmail}`} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              {demo.leadEmail || "—"}
            </a>
          </KeyValue>
          <KeyValue label="Company">
            <span className="font-medium">{demo.leadCompany || "—"}</span>
          </KeyValue>
          <KeyValue label="Stage">
            <Badge className={STAGE_STYLES[demo.leadStage as keyof typeof STAGE_STYLES] ?? STAGE_STYLES.new}>
              {STAGE_LABELS[demo.leadStage as keyof typeof STAGE_LABELS] ?? demo.leadStage}
            </Badge>
          </KeyValue>
          <KeyValue label="Band">
            {demo.leadBand !== "cold" ? <span className="capitalize font-medium">{demo.leadBand.replace(/_/g, " ")}</span> : <span className="text-zinc-400">—</span>}
          </KeyValue>
          <KeyValue label="Priority">
            {demo.priority ? <span className="font-medium capitalize">{demo.priority}</span> : <span className="text-zinc-400">—</span>}
          </KeyValue>
          <KeyValue label="Owner">
            <span className="font-medium">{demo.leadOwnerEmail || "—"}</span>
          </KeyValue>
          <KeyValue label="Outcome">
            {demo.convertedCustomerId ? (
              <StatusBadge domain="demo" status="converted" />
            ) : (
              <span className="text-zinc-400">Not converted</span>
            )}
          </KeyValue>
        </dl>
      </DrawerSection>

      <DrawerSection title="Property intelligence">
        <dl>
          <KeyValue label="Property">
            <span className="font-medium">{demo.leadProperty || "—"}</span>
          </KeyValue>
          <KeyValue label="Type">
            <span>{demo.propertyType || "—"}</span>
          </KeyValue>
          <KeyValue label="Rooms">
            <span className="tabular-nums">{demo.rooms ?? "—"}</span>
          </KeyValue>
          <KeyValue label="Current PMS">
            <span>{demo.currentPms || "—"}</span>
          </KeyValue>
        </dl>
        <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-zinc-400">
          Property score and claim status aren&apos;t linked to marketing leads yet — coming with the property intelligence upgrade.
        </p>
      </DrawerSection>

      <DrawerSection title="Sales context">
        <dl>
          <KeyValue label="Est. value">
            <span className="font-medium tabular-nums">
              {demo.estimatedValue > 0 ? formatMoney(demo.estimatedValue, demo.estimatedValueCurrency ?? "USD") : "—"}
            </span>
          </KeyValue>
          <KeyValue label="Source">
            <span className="capitalize">{demo.leadSource.replace(/_/g, " ") || "—"}</span>
          </KeyValue>
          <KeyValue label="Campaign">
            <span>{demo.campaign || "—"}</span>
          </KeyValue>
          <KeyValue label="Affiliate">
            <span>{demo.affiliateName || "—"}</span>
          </KeyValue>
          <KeyValue label="Last contact">
            <span className="tabular-nums">{demo.lastContactAt ? formatRelative(demo.lastContactAt) : "—"}</span>
          </KeyValue>
          <KeyValue label="Next follow-up">
            <span className="tabular-nums">{demo.nextFollowUpAt ? formatRelative(demo.nextFollowUpAt) : "—"}</span>
          </KeyValue>
          <KeyValue label="Scheduled">
            <span className="tabular-nums">{timeOf(demo.startAt)} ({demo.durationMin} min)</span>
          </KeyValue>
        </dl>
      </DrawerSection>

      <DrawerSection title="Activity">
        <Timeline entries={events} />
      </DrawerSection>
    </DetailDrawer>
  );
}