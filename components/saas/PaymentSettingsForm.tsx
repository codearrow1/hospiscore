"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { validateRouting } from "@/lib/saas/payments/routing";
import type { RoutingIssue } from "@/lib/saas/payments/routing";

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
  fees?: { default?: { percent?: number; fixedMinor?: number; capMinor?: number }; byCurrency?: Record<string, unknown> };
  credentials: {
    publishableKey?: string;
    secretKey?: MaskedSecret;
    token?: MaskedSecret;
    webhookSecret?: MaskedSecret;
    extra?: Record<string, MaskedSecret>;
  };
  webhookPath: string;
  health?: { healthy?: boolean; lastCheckedAt?: number | null; successRate?: number | null; consecutiveFailures?: number };
}
interface HealthView {
  providerId: string;
  healthy: boolean;
  lastCheckedAt: number | null;
  successRate: number | null;
  consecutiveFailures: number;
  totalCalls: number;
}
interface Meta {
  id: string;
  label: string;
  family: "fiat" | "crypto";
}

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  inputType?: "password" | "text";
}
interface ProviderMeta {
  id: string;
  label: string;
  family: string;
  wired: boolean;
  credentialFields?: CredentialField[];
  webhook?: { description: string; signatureMethod: string; events: string[] };
}
interface MatrixRow {
  id: string;
  label: string;
  family: string;
  tier: number;
  implemented: boolean;
  wired: boolean;
  sandbox: boolean;
  countries: string[];
  currencies: string[];
  methods: string[];
  capabilities: string[];
}

const STATUS_LABEL: Record<string, string> = {
  ready: "Ready", verifying: "Verifying", verification_failed: "Verification failed",
  disabled: "Disabled", misconfigured: "Misconfigured", verify: "Wired (needs live test)", registered: "Registered",
};
const STATUS_STYLE: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  verifying: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  verification_failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  misconfigured: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  disabled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  verify: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  registered: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const METHODS = ["card", "upi", "wallet", "bank_transfer", "netbanking", "emi", "paypal", "apple_pay", "google_pay", "crypto", "manual"];
const METHOD_LABEL: Record<string, string> = {
  card: "Card", upi: "UPI", wallet: "Wallet", bank_transfer: "Bank transfer", netbanking: "Net banking",
  emi: "EMI", paypal: "PayPal", apple_pay: "Apple Pay", google_pay: "Google Pay", crypto: "Crypto", manual: "Manual",
};

function maskLabel(m?: MaskedSecret): string {
  return m?.masked || (m?.set ? "••••" : "");
}

export default function PaymentSettingsForm({ viewerEmail }: { viewerEmail?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<Meta[]>([]);
  const [metaMap, setMetaMap] = useState<Record<string, ProviderMeta>>({});
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [health, setHealth] = useState<Record<string, HealthView>>({});
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [encKey, setEncKey] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // pending secret input state (editable per provider)
  const [secretInputs, setSecretInputs] = useState<Record<string, { publishableKey?: string; secretKey?: string; token?: string; webhookSecret?: string; extra?: Record<string, string> }>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/saas/payments/providers").catch(() => null);
    if (!res?.ok) {
      toast.error("Could not load payment providers.");
      setLoading(false);
      return;
    }
    const d = await res.json().catch(() => ({}));
    setCatalog((d.catalog ?? []) as Meta[]);
    const mmap: Record<string, ProviderMeta> = {};
    for (const m of (d.meta ?? []) as ProviderMeta[]) mmap[m.id] = m;
    setMetaMap(mmap);
    const map: Record<string, ProviderConfig> = {};
    for (const p of (d.providers ?? []) as ProviderConfig[]) map[p.id] = p;
    setProviders(map);
    const hmap: Record<string, HealthView> = {};
    for (const h of (d.health ?? []) as HealthView[]) hmap[h.providerId] = h;
    setHealth(hmap);
    setMatrix((d.capabilityMatrix ?? []) as MatrixRow[]);
    setEncKey(Boolean(d.encKeyConfigured));
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setProv = (id: string, patch: Partial<ProviderConfig>) =>
    setProviders((prev) => ({ ...prev, [id]: { ...(prev[id] as ProviderConfig), ...patch } }));

  const addProvider = (id: string) => {
    const meta = catalog.find((c) => c.id === id);
    if (!meta) return;
    setProviders((prev) => ({
      ...prev,
      [id]: {
        id,
        label: meta.label,
        integrationStatus: "registered",
        family: meta.family,
        enabled: false,
        isDefault: false,
        priority: 100,
        mode: "test",
        countries: [],
        currencies: [],
        methods: ["card"],
        capabilities: [],
        fees: { default: { percent: 0, fixedMinor: 0, capMinor: undefined } },
        credentials: {},
        webhookPath: `/api/payments/webhook/${id}`,
        health: {},
      },
    }));
  };

  const toggleMethod = (id: string, m: string) => {
    const cur = providers[id]?.methods ?? [];
    setProv(id, { methods: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] });
  };

  const save = async (id: string) => {
    setBusy(id);
    const p = providers[id];
    try {
      const payload: Record<string, unknown> = {
        id: p.id,
        label: p.label,
        enabled: p.enabled,
        isDefault: p.isDefault,
        priority: p.priority,
        mode: p.mode,
        countries: splitList(p.countries as unknown as string),
        currencies: splitList(p.currencies as unknown as string),
        methods: p.methods,
        capabilities: p.capabilities,
        fees: p.fees,
      };
      const si = secretInputs[id];
      const anySecret =
        (si && Object.values(si).some((v) => {
          if (typeof v === "string") return v.trim() !== "";
          if (v && typeof v === "object") return Object.values(v).some((x) => x.trim() !== "");
          return false;
        })) || false;
      if (anySecret) {
        payload.secrets = {
          publishableKey: si?.publishableKey?.trim() || undefined,
          secretKey: si?.secretKey?.trim() || undefined,
          token: si?.token?.trim() || undefined,
          webhookSecret: si?.webhookSecret?.trim() || undefined,
          extra: si?.extra && Object.values(si.extra).some((v) => v.trim() !== "")
            ? Object.fromEntries(Object.entries(si.extra).filter(([, v]) => v.trim() !== ""))
            : undefined,
        };
      }
      const res = await fetch("/api/saas/payments/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((d as { error?: string }).error ?? "Save failed");
        return;
      }
      setProv(id, (d as { provider: ProviderConfig }).provider);
      setSecretInputs((prev) => ({ ...prev, [id]: {} }));
      toast.success("Provider saved. Secrets are masked.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const testConnection = async (id: string) => {
    setTesting(id);
    const si = secretInputs[id] ?? {};
    try {
      const res = await fetch(`/api/saas/payments/providers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-connection",
          secrets: {
            publishableKey: si.publishableKey?.trim() || undefined,
            secretKey: si.secretKey?.trim() || undefined,
            webhookSecret: si.webhookSecret?.trim() || undefined,
            token: si.token?.trim() || undefined,
            extra: si.extra && Object.values(si.extra).some((v) => v.trim() !== "") ? Object.fromEntries(Object.entries(si.extra).filter(([, v]) => v.trim() !== "")) : undefined,
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      const r = (d.result ?? {}) as { status?: string; error?: string };
      setProv(id, { integrationStatus: (d.provider as ProviderConfig | undefined)?.integrationStatus ?? providers[id]?.integrationStatus });
      if (r.status === "CONNECTED") toast.success(`${providers[id]?.label ?? id} connection OK — Ready.`);
      else if (r.status === "UNSUPPORTED") toast.info(r.error ?? "No safe connection test for this provider.");
      else if (r.status === "MISCONFIGURED") toast.error(r.error ?? "Provider is missing required credentials.");
      else toast.error(r.error ?? "Connection failed.");
      await load();
      router.refresh();
    } finally {
      setTesting(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(`Remove provider ${providers[id]?.label ?? id}?`)) return;
    const res = await fetch(`/api/saas/payments/providers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProviders((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Provider removed.");
      router.refresh();
    } else {
      toast.error("Could not remove provider.");
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;

  const setSecret = (id: string, key: string, value: string) => {
    setSecretInputs((prev) => ({
      ...prev,
      [id]: key.startsWith("extra.")
        ? {
            ...(prev[id] ?? {}),
            extra: { ...((prev[id]?.extra ?? {}) as Record<string, string>), [key.slice("extra.".length)]: value },
          }
        : { ...(prev[id] ?? {}), [key]: value },
    }));
  };

  const unconfigured = catalog.filter((c) => !providers[c.id]);

  return (
    <div className="space-y-5">
      {!encKey && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <strong>Encryption key not set.</strong> Add <code>PAYMENT_ENC_KEY</code> to your environment to encrypt provider
          secrets at rest. Until then, secrets are stored with a derived fallback key (demo-grade) — set the env var before
          production.
        </div>
      )}

      {unconfigured.length > 0 && (
        <SectionCard title="Add a payment provider" subtitle="Select a gateway to configure. Unwired providers register without fake capabilities.">
          <div className="flex flex-wrap gap-2">
            {unconfigured.map((c) => (
              <button
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-700 hover:border-indigo-300 dark:text-zinc-200"
                onClick={() => addProvider(c.id)}
              >
                {c.id === "coinbase" ? "🪙" : "⚙️"} {c.label}
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {Object.keys(providers).length === 0 && (
        <SectionCard title="No providers configured">
          <p className="text-sm text-zinc-500">Add a provider above to begin accepting secure, webhook-confirmed payments.</p>
        </SectionCard>
      )}

      {Object.keys(providers).length > 0 && <RoutingEditor providers={Object.values(providers)} setPriority={setProv} />}

      {matrix.length > 0 && <CapabilityMatrix rows={matrix} />}

      {Object.values(providers).map((p) => {
        const h = health[p.id];
        const capUnderscore = p.capabilities.length === 0;
        return (
          <SectionCard
            key={p.id}
            title={p.label}
            subtitle={`${p.id} · family: ${p.family}${h ? ` · health: ${h.healthy ? "healthy" : h.totalCalls > 0 ? "degraded" : "unchecked"}` : ""}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.integrationStatus] ?? STATUS_STYLE.registered}`}>
                  {STATUS_LABEL[p.integrationStatus] ?? p.integrationStatus}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    p.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {p.enabled ? "Enabled" : "Disabled"}
                </span>
                <Link href={`/saas/settings/payments/${p.id}`} className="inline-flex rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-surface-subtle dark:text-indigo-400">
                  Details
                </Link>
              </div>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={p.enabled} onChange={(e) => setProv(p.id, { enabled: e.target.checked })} />
                <span className="text-sm text-zinc-700 dark:text-zinc-200">Enabled</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={p.isDefault} onChange={(e) => setProv(p.id, { isDefault: e.target.checked })} />
                <span className="text-sm text-zinc-700 dark:text-zinc-200">Default provider (fallback)</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Priority</label>
                <input
                  type="number" min={1}
                  className="w-24 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                  value={p.priority}
                  onChange={(e) => setProv(p.id, { priority: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Mode</label>
                <select
                  className="rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                  value={p.mode}
                  onChange={(e) => setProv(p.id, { mode: e.target.value as "test" | "live" })}
                >
                  <option value="test">Test (sandbox)</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <Field text="Countries (ISO2, comma-separated — empty = all)" value={(p.countries ?? []).join(", ")} onChange={(v) => setProv(p.id, { countries: splitList(v) as never })} />
              <Field text="Currencies (ISO 4217, comma-separated — empty = all)" value={(p.currencies ?? []).join(", ")} onChange={(v) => setProv(p.id, { currencies: splitList(v) as never })} />
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Payment methods</p>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <label key={m} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-300">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={(p.methods ?? []).includes(m)} onChange={() => toggleMethod(p.id, m)} />
                    {METHOD_LABEL[m] ?? m}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <FieldUnit text="Fee % (default)" value={String(p.fees?.default?.percent ?? "")} onChange={(v) => setProv(p.id, { fees: feePatch(p, { percent: parseFloat(v) || 0 }) })} />
              <FieldUnit text="Fixed fee (minor units)" value={String(p.fees?.default?.fixedMinor ?? "")} onChange={(v) => setProv(p.id, { fees: feePatch(p, { fixedMinor: parseInt(v || "0", 10) || 0 }) })} />
              <FieldUnit text="Fee cap (minor units)" value={String(p.fees?.default?.capMinor ?? "")} onChange={(v) => setProv(p.id, { fees: feePatch(p, { capMinor: parseInt(v || "0", 10) || 0 }) })} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(() => {
                const fields = metaMap[p.id]?.credentialFields;
                if (fields && fields.length > 0) {
                  return fields.map((f) => {
                    if (f.key === "publishableKey") {
                      return <SecretInput key={f.key} label={f.label} placeholder={p.credentials.publishableKey ? maskLabel({ set: true, masked: String(p.credentials.publishableKey), updatedAt: null }) : f.placeholder} value={secretInputs[p.id]?.publishableKey ?? ""} onChange={(v) => setSecret(p.id, f.key, v)} />;
                    }
                    if (f.key === "secretKey") {
                      return <SecretInput key={f.key} label={f.label} placeholder={maskLabel(p.credentials.secretKey) || f.placeholder} value={secretInputs[p.id]?.secretKey ?? ""} onChange={(v) => setSecret(p.id, f.key, v)} />;
                    }
                    if (f.key === "token") {
                      return <SecretInput key={f.key} label={f.label} placeholder={maskLabel(p.credentials.token) || f.placeholder} value={secretInputs[p.id]?.token ?? ""} onChange={(v) => setSecret(p.id, f.key, v)} />;
                    }
                    if (f.key === "webhookSecret") {
                      return <SecretInput key={f.key} label={f.label} placeholder={maskLabel(p.credentials.webhookSecret) || f.placeholder} value={secretInputs[p.id]?.webhookSecret ?? ""} onChange={(v) => setSecret(p.id, f.key, v)} />;
                    }
                    if (f.key.startsWith("extra.")) {
                      const ename = f.key.slice("extra.".length);
                      const cur = p.credentials.extra?.[ename];
                      return <SecretInput key={f.key} label={f.label} placeholder={cur ? maskLabel({ set: true, masked: String(cur.masked), updatedAt: null }) : f.placeholder} value={secretInputs[p.id]?.extra?.[ename] ?? ""} onChange={(v) => setSecret(p.id, f.key, v)} />;
                    }
                    return <SecretInput key={f.key} label={f.label} placeholder={f.placeholder} value={secretInputs[p.id]?.[f.key as "token"] ?? ""} onChange={(v) => setSecret(p.id, f.key, v)} />;
                  });
                }
                return (
                  <>
                    <SecretInput label="Publishable key" placeholder={p.credentials.publishableKey ? maskLabel({ set: true, masked: String(p.credentials.publishableKey), updatedAt: null }) : "pk_live_…"} value={secretInputs[p.id]?.publishableKey ?? ""} onChange={(v) => setSecret(p.id, "publishableKey", v)} />
                    <SecretInput label="Secret key" placeholder={maskLabel(p.credentials.secretKey) || "sk_live_…"} value={secretInputs[p.id]?.secretKey ?? ""} onChange={(v) => setSecret(p.id, "secretKey", v)} />
                    <SecretInput label="Token / client secret" placeholder={maskLabel(p.credentials.token) || "…"} value={secretInputs[p.id]?.token ?? ""} onChange={(v) => setSecret(p.id, "token", v)} />
                    <SecretInput label="Webhook signing secret" placeholder={maskLabel(p.credentials.webhookSecret) || "whsec_…"} value={secretInputs[p.id]?.webhookSecret ?? ""} onChange={(v) => setSecret(p.id, "webhookSecret", v)} />
                  </>
                );
              })()}
            </div>

            <div className="mt-4 space-y-1 rounded-xl border border-line bg-surface-subtle p-3 text-xs text-zinc-500 dark:text-zinc-400">
              <p><strong>Webhook endpoint:</strong> <code className="break-all">{p.webhookPath}</code></p>
              <p><strong>Webhook secret:</strong> {p.credentials.webhookSecret?.set ? "Configured (masked)" : "Not set"}</p>
              {metaMap[p.id]?.webhook ? (
                <>
                  <p><strong>Signature:</strong> {metaMap[p.id]?.webhook?.signatureMethod}</p>
                  <p><strong>Required events:</strong> {metaMap[p.id]?.webhook?.events.join(", ")}</p>
                </>
              ) : (
                <p><strong>Capabilities:</strong> {capUnderscore && p.capabilities.length === 0 && p.integrationStatus === "registered" ? "none (registered but not wired — no fake capabilities)" : (p.capabilities.join(", ") || "none")}</p>
              )}
              {h && (
                <p>
                  <strong>Health:</strong> {h.healthy ? "healthy" : "unhealthy"} · success{" "}
                  {h.successRate != null ? `${Math.round(h.successRate * 100)}%` : "n/a"} · failures {h.consecutiveFailures} · checks {h.totalCalls}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                onClick={() => void save(p.id)}
                disabled={busy === p.id}
              >
                {busy === p.id ? "Saving…" : "Save provider"}
              </button>
              <button
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-surface-subtle dark:text-zinc-200"
                onClick={() => void testConnection(p.id)}
                disabled={testing === p.id}
              >
                {testing === p.id ? "Testing…" : "Test connection"}
              </button>
              <button
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-700/50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                onClick={() => void remove(p.id)}
              >
                Remove
              </button>
            </div>
          </SectionCard>
        );
      })}

      <div className="flex justify-end">
        {viewerEmail && <span className="mr-auto self-center text-xs text-zinc-400">Editing as {viewerEmail}</span>}
      </div>
    </div>
  );
}

function splitList(v: string): string[] {
  return String(v || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

const SEVERITY_STYLE: Record<RoutingIssue["severity"], string> = {
  error: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
  warning: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
};

function CapabilityMatrix({ rows }: { rows: MatrixRow[] }) {
  return (
    <SectionCard
      title="Capability matrix"
      subtitle="Single source of truth for what each catalog provider actually supports (derived from official provider docs — never hardcoded UI claims)."
    >
      <div className="overflow-x-auto text-sm">
        <table className="w-full text-left">
          <thead className="text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="py-1 pr-3">Provider</th>
              <th className="py-1 pr-3">Tier</th>
              <th className="py-1 pr-3">Wired</th>
              <th className="py-1 pr-3">Sandbox</th>
              <th className="py-1 pr-3">Countries</th>
              <th className="py-1 pr-3">Currencies</th>
              <th className="py-1 pr-3">Methods</th>
              <th className="py-1">Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line text-zinc-700 dark:text-zinc-200">
                <td className="py-1.5 pr-3">
                  <span className="font-medium">{r.label}</span>
                  <div className="text-xs text-zinc-400">{r.family}</div>
                </td>
                <td className="py-1.5 pr-3">T{r.tier}</td>
                <td className="py-1.5 pr-3">{r.implemented ? (r.wired ? "Yes" : "Adapter only") : "No"}</td>
                <td className="py-1.5 pr-3">{r.sandbox ? "Yes" : "No"}</td>
                <td className="py-1.5 pr-3">{r.countries.join(", ") || "—"}</td>
                <td className="py-1.5 pr-3">{r.currencies.join(", ") || "—"}</td>
                <td className="py-1.5 pr-3">{r.methods.join(", ") || "—"}</td>
                <td className="py-1.5 text-xs">{r.capabilities.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function RoutingEditor({
  providers,
  setPriority,
}: {
  providers: ProviderConfig[];
  setPriority: (id: string, patch: Partial<ProviderConfig>) => void;
}) {
  const sorted = [...providers].sort((a, b) => (a.enabled !== b.enabled ? (a.enabled ? -1 : 1) : a.priority - b.priority));
  const issues = validateRouting(providers);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    // Swap priorities so ordering is deterministic.
    setPriority(a.id, { priority: b.priority });
    setPriority(b.id, { priority: a.priority });
  };

  return (
    <SectionCard
      title="Routing"
      subtitle="Providers are routed in ascending priority order; the default wins among verified providers. Lower number = tried first."
      action={issues.length > 0 ? <span className="text-xs font-semibold text-zinc-500">{issues.length} issue{issues.length > 1 ? "s" : ""}</span> : <span className="text-xs font-semibold text-emerald-600">No issues</span>}
    >
      <ol className="space-y-1">
        {sorted.map((p, i) => {
          const routable = p.enabled && (p.integrationStatus === "ready" || p.integrationStatus === "verify");
          return (
            <li key={p.id} className={`flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm ${routable ? "bg-surface" : "bg-surface-subtle opacity-80"}`}>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-100">↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === sorted.length - 1} className="rounded px-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-100">↓</button>
              </div>
              <span className="w-8 font-mono text-xs text-zinc-400">#{p.priority}</span>
              <span className="flex-1 font-medium text-zinc-800 dark:text-zinc-100">{p.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${routable ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {routable ? "Routable" : p.enabled ? STATUS_LABEL[p.integrationStatus] ?? p.integrationStatus : "Disabled"}
              </span>
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-indigo-600"
                  checked={p.isDefault}
                  onChange={(e) => setPriority(p.id, { isDefault: e.target.checked })}
                />
                Default
              </label>
            </li>
          );
        })}
      </ol>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-1">
          {issues.map((iss, idx) => (
            <li key={`${iss.code}-${idx}`} className={`rounded-lg border px-3 py-2 text-xs ${SEVERITY_STYLE[iss.severity]}`}>
              <strong>{iss.severity.toUpperCase()}</strong> · {iss.message}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function feePatch(p: ProviderConfig, patch: Record<string, unknown>) {
  return { ...(p.fees ?? {}), default: { ...((p.fees?.default ?? {}) as object), ...patch } };
}

function Field({ text, value, onChange }: { text: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{text}</label>
      <input
        className="rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FieldUnit({ text, value, onChange }: { text: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{text}</label>
      <input
        className="rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SecretInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</label>
      <input
        type="password"
        className="rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
