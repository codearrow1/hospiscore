"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";

interface MaskedSecret {
  set: boolean;
  masked: string | null;
  updatedAt: number | null;
}
interface ProviderConfig {
  id: string;
  label: string;
  integrationStatus: string;
  family: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  mode: "test" | "live";
  countries: string[];
  currencies: string[];
  methods: string[];
  capabilities: string[];
  credentials: {
    publishableKey?: string;
    secretKey?: MaskedSecret;
    token?: MaskedSecret;
    webhookSecret?: MaskedSecret;
    extra?: Record<string, MaskedSecret>;
  };
  webhookPath: string;
  health?: { healthy?: boolean; successRate?: number | null; consecutiveFailures?: number };
}
interface HealthView {
  providerId: string;
  healthy: boolean;
  lastCheckedAt: number | null;
  lastError: string | null;
  successRate: number | null;
  consecutiveFailures: number;
  totalCalls: number;
}
interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  inputType?: "password" | "text";
}
interface WebhookMeta {
  description: string;
  signatureMethod: string;
  events: string[];
}
interface Meta {
  id: string;
  label: string;
  family: string;
  wired: boolean;
  credentialFields?: CredentialField[];
  webhook?: WebhookMeta;
}
interface WebhookHealth {
  providerId: string;
  totalEvents: number;
  lastWebhookAt: number | null;
  lastStatus: string | null;
  lastFailureAt: number | null;
  lastFailureNote: string | null;
  failures: number;
  verified: number;
  reconciled: number;
  pending: number;
  ignored: number;
}
interface WebhookRow {
  id: string;
  provider: string;
  eventId: string;
  status: string;
  intentId: string | null;
  verificationNote: string | null;
  createdAt: string;
}
interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  ready: "Ready", verifying: "Verifying", verification_failed: "Verification failed",
  disabled: "Disabled", misconfigured: "Misconfigured", verify: "Wired (needs live test)", registered: "Registered",
};

function fmtTime(ms: number | null | string | undefined): string {
  if (ms == null) return "—";
  const d = typeof ms === "string" ? new Date(ms) : new Date(ms);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function ProviderDetailClient({ providerId, viewerEmail }: { providerId: string; viewerEmail?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [health, setHealth] = useState<HealthView | null>(null);
  const [wh, setWh] = useState<WebhookHealth[]>([]);
  const [recentWebhooks, setRecentWebhooks] = useState<WebhookRow[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentRow[]>([]);
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ status: string; error?: string } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/saas/payments/providers/${providerId}`).catch(() => null);
    if (!res?.ok) {
      toast.error("Could not load provider.");
      setLoading(false);
      return;
    }
    const d = await res.json().catch(() => ({}));
    setProvider(d.provider ?? null);
    setMeta(d.meta ?? null);
    setHealth(d.health ?? null);
    setWh(d.webhookHealth ?? []);
    setRecentWebhooks(d.recentWebhooks ?? []);
    setRecentPayments(d.recentPayments ?? []);
    setLoading(false);
  }, [providerId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyEndpoint = async () => {
    if (!provider?.webhookPath) return;
    await navigator.clipboard?.writeText(window.location.origin + provider.webhookPath).catch(() => null);
    toast.success("Webhook endpoint copied.");
  };

  const testConnection = async () => {
    if (!provider) return;
    setTesting(true);
    setResult(null);
    const secrets: Record<string, string | undefined> = {};
    const extra: Record<string, string> = {};
    for (const f of meta?.credentialFields ?? []) {
      const v = secretInputs[f.key] || undefined;
      if (f.key.startsWith("extra.")) {
        if (v) extra[f.key.slice("extra.".length)] = v;
      } else {
        secrets[f.key] = v;
      }
    }
    const payload = {
      action: "test-connection",
      secrets: {
        publishableKey: secrets.publishableKey,
        secretKey: secrets.secretKey,
        token: secrets.token,
        webhookSecret: secrets.webhookSecret,
        extra: Object.keys(extra).length ? extra : undefined,
      },
    };
    try {
      const res = await fetch(`/api/saas/payments/providers/${providerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      const r = (d.result ?? {}) as { status?: string; error?: string };
      if (r.status === "CONNECTED") toast.success("Connection OK — provider is Ready.");
      else if (r.status === "UNSUPPORTED") toast.info(r.error ?? "No safe connection test for this provider.");
      else if (r.status === "MISCONFIGURED") toast.error(r.error ?? "Provider is missing required credentials.");
      else toast.error(r.error ?? "Connection failed.");
      setResult({ status: r.status ?? "FAILED", error: r.error });
      await load();
      router.refresh();
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;
  if (!provider) return <p className="text-sm text-zinc-500">Provider not found.</p>;

  const fields = meta?.credentialFields ?? [];
  const whHealth = wh[0];
  const envSafe = provider.mode === "live";
  const statusOk = provider.integrationStatus === "ready";

  return (
    <div className="space-y-5">
      <SectionCard
        title={`${provider.label} (${provider.id})`}
        subtitle="Activation status is driven by real connection verification — never faked."
        action={
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusOk ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
              {STATUS_LABEL[provider.integrationStatus] ?? provider.integrationStatus}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${envSafe ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"}`}>
              {envSafe ? "LIVE" : "TEST"}
            </span>
          </div>
        }
      >
        <div className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-200 sm:grid-cols-3">
          <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Enabled</span><p>{provider.enabled ? "Yes" : "No"}</p></div>
          <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Default</span><p>{provider.isDefault ? "Yes" : "No"}</p></div>
          <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Priority</span><p>{provider.priority}</p></div>
          <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Currencies</span><p>{provider.currencies.join(", ") || "all"}</p></div>
          <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Countries</span><p>{provider.countries.join(", ") || "all"}</p></div>
          <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Methods</span><p>{provider.methods.join(", ") || "—"}</p></div>
        </div>
        {envSafe && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200">
            <strong>Live mode.</strong> This provider is configured for LIVE payments. Verify this is intended; real charges apply once routed.
          </div>
        )}
        {!statusOk && provider.enabled && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
            Not Ready — this provider will <strong>not</strong> be routed for payments until a connection test succeeds.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Connection test" subtitle="Runs a read-only ping to the provider using the saved (or entered) credentials. Only a CONNECTED result marks the provider Ready.">
        {fields.length > 0 && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {f.label} {f.required && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type={f.inputType ?? "password"}
                  autoComplete="off"
                  placeholder={f.placeholder}
                  value={secretInputs[f.key] ?? ""}
                  onChange={(e) => setSecretInputs((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                />
              </div>
            ))}
          </div>
        )}
        {fields.length === 0 && (
          <p className="mb-3 text-sm text-zinc-500">No connection test available for this provider.</p>
        )}
        <div className="flex items-center gap-3">
          <button
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            onClick={() => void testConnection()}
            disabled={testing}
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          {result && (
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              Result: <strong>{result.status}</strong>
              {result.error ? ` — ${result.error}` : ""}
            </span>
          )}
        </div>
        {health && (
          <p className="mt-3 text-xs text-zinc-500">
            Connection health: {health.healthy ? "healthy" : "unhealthy"} · success{" "}
            {health.successRate != null ? `${Math.round(health.successRate * 100)}%` : "n/a"} · calls {health.totalCalls} ·
            consecutive failures {health.consecutiveFailures} · last check {fmtTime(health.lastCheckedAt)}
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Webhook configuration"
        subtitle="Configure these events in your provider dashboard. The endpoint must be reachable over the internet."
        action={
          <button onClick={() => void copyEndpoint()} className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-surface-subtle dark:text-zinc-200">
            Copy webhook endpoint
          </button>
        }
      >
        <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
          <p><strong>Endpoint:</strong> <code className="break-all">{origin}{provider.webhookPath}</code></p>
          <p><strong>Webhook secret:</strong> {provider.credentials.webhookSecret?.set ? "Configured (masked)" : "Not set"} </p>
          {meta?.webhook && (
            <>
              <p><strong>Signature method:</strong> {meta.webhook.signatureMethod}</p>
              <p><strong>Required events:</strong></p>
              <div className="flex flex-wrap gap-2">
                {meta.webhook.events.map((e) => (
                  <span key={e} className="rounded-lg border border-line bg-surface-subtle px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-300">{e}</span>
                ))}
              </div>
              <p className="text-xs text-zinc-500">{meta.webhook.description}</p>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Webhook health" subtitle="What the provider has actually delivered and confirmed (payloads are never shown).">
        {whHealth && whHealth.totalEvents > 0 ? (
          <div className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-200 sm:grid-cols-3">
            <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Total events</span><p className="text-xl font-bold">{whHealth.totalEvents}</p></div>
            <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Last webhook</span><p>{fmtTime(whHealth.lastWebhookAt)}</p></div>
            <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Last status</span><p>{whHealth.lastStatus ?? "—"}</p></div>
            <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Failures</span><p className="text-xl font-bold text-rose-600">{whHealth.failures}</p></div>
            <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Verified</span><p className="text-xl font-bold">{whHealth.verified}</p></div>
            <div><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Reconciled</span><p className="text-xl font-bold">{whHealth.reconciled}</p></div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No webhooks received yet. Live webhook delivery is reflected here once configured.</p>
        )}
        {whHealth && whHealth.failures > 0 && (
          <p className="mt-3 text-xs text-rose-600">Latest failure: {whHealth.lastFailureNote ?? "—"} at {fmtTime(whHealth.lastFailureAt)}</p>
        )}
      </SectionCard>

      <SectionCard title="Recent webhook log" subtitle="Verification + reconciliation outcomes (no payloads, no secrets).">
        {recentWebhooks.length === 0 ? (
          <p className="text-sm text-zinc-500">No webhook events recorded.</p>
        ) : (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wide text-zinc-400">
                <tr><th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Event</th><th className="py-1 pr-3">Time</th><th className="py-1">Note</th></tr>
              </thead>
              <tbody>
                {recentWebhooks.map((w) => (
                  <tr key={w.id} className="border-t border-line text-zinc-700 dark:text-zinc-200">
                    <td className="py-1.5 pr-3">{w.status}</td>
                    <td className="py-1.5 pr-3"><code>{w.eventId}</code></td>
                    <td className="py-1.5 pr-3">{fmtTime(w.createdAt)}</td>
                    <td className="py-1.5 text-xs text-zinc-500">{w.verificationNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent payments" subtitle="Canonical ledger entries settled via this provider.">
        {recentPayments.length === 0 ? (
          <p className="text-sm text-zinc-500">No settled payments yet.</p>
        ) : (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wide text-zinc-400">
                <tr><th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Amount</th><th className="py-1 pr-3">Method</th><th className="py-1">Time</th></tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id} className="border-t border-line text-zinc-700 dark:text-zinc-200">
                    <td className="py-1.5 pr-3">{p.status}</td>
                    <td className="py-1.5 pr-3">{p.currency} {p.amount}</td>
                    <td className="py-1.5 pr-3">{p.method ?? "—"}</td>
                    <td className="py-1.5">{fmtTime(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {viewerEmail && <p className="text-xs text-zinc-400">Editing as {viewerEmail}</p>}
    </div>
  );
}
