/**
 * Payment Sandbox harness.
 *
 * Runs a REAL connection test (`testConnection`) against every wired payment
 * provider using credentials supplied via environment variables, and prints an
 * honest per-provider table. It NEVER fabricates a "PASS": if a provider has no
 * credentials in env it reports NOT CONFIGURED; if the provider has no real
 * connection test it reports UNSUPPORTED; otherwise it maps the live result.
 *
 * Outcomes:
 *   PASS  = live sandbox/live endpoint reached and authenticated
 *   FAIL  = credentials present but the endpoint rejected/errored
 *   NOT CONFIGURED = no credentials supplied in this environment
 *   UNSUPPORTED = provider has no safe, charge-free connection test
 *
 * Credential env contract (mirrors docs/PAYMENT_ENV.md). Each provider reads
 * only the fields it needs; extras are tolerated:
 *   PAY_<PROVIDER>_SECRET_KEY      → credentials.secretKey
 *   PAY_<PROVIDER>_PUBLISHABLE_KEY → credentials.publishableKey
 *   PAY_<PROVIDER>_TOKEN           → credentials.token
 *   PAY_<PROVIDER>_WEBHOOK_SECRET  → credentials.webhookSecret
 *   PAY_<PROVIDER>_EXTRA_<K>       → credentials.extra[ K in lowercase ]
 *
 * Run: `npx tsx scripts/payment-sandbox.ts`
 */
import { instantiateAdapter } from "@/lib/saas/payments/factory";
import type { ProviderConfig, ProviderCredentials, ProviderIntegrationStatus } from "@/lib/saas/payments/types";

interface SandboxRow {
  provider: string;
  outcome: "PASS" | "FAIL" | "NOT CONFIGURED" | "UNSUPPORTED";
  detail: string;
}

const PROVIDERS = [
  "checkout.com",
  "square",
  "mollie",
  "phonepe",
  "paytm",
  "easebuzz",
  "stripe",
  "razorpay",
  "paypal",
  "adyen",
  "cashfree",
  "payu",
] as const;

function envKey(provider: string, name: string): string {
  return `PAY_${provider.toUpperCase().replace(/\./g, "_").replace(/-/g, "_")}_${name}`;
}

function credsFromEnv(provider: string): ProviderCredentials {
  const mk = (raw: string | undefined) =>
    raw && raw.trim() ? { set: true as const, masked: raw.trim(), updatedAt: Date.now() } : undefined;
  const extra: Record<string, { set: boolean; masked: string; updatedAt: number }> = {};
  // Collect any PAY_<PROVIDER>_EXTRA_* vars generically.
  for (const [k, v] of Object.entries(process.env)) {
    const prefix = `PAY_${provider.toUpperCase().replace(/\./g, "_").replace(/-/g, "_")}_EXTRA_`;
    if (k.startsWith(prefix) && v) {
      const extraName = k.slice(prefix.length).toLowerCase();
      extra[extraName] = { set: true, masked: v, updatedAt: Date.now() };
    }
  }
  const rawPub = process.env[envKey(provider, "PUBLISHABLE_KEY")];
  return {
    publishableKey: rawPub && rawPub.trim() ? rawPub.trim() : undefined,
    secretKey: mk(process.env[envKey(provider, "SECRET_KEY")]!),
    token: mk(process.env[envKey(provider, "TOKEN")]!),
    webhookSecret: mk(process.env[envKey(provider, "WEBHOOK_SECRET")]!),
    extra: extra as ProviderCredentials["extra"],
  };
}

function hasAnyCredential(c: ProviderCredentials): boolean {
  return Boolean(
    c.publishableKey || c.secretKey || c.token || c.webhookSecret ||
    (c.extra && Object.keys(c.extra).length > 0),
  );
}

function stubConfig(id: string, status: ProviderIntegrationStatus): ProviderConfig {
  return {
    id,
    label: id,
    integrationStatus: status,
    family: "fiat",
    enabled: true,
    isDefault: false,
    priority: 100,
    mode: "test",
    countries: [],
    currencies: [],
    methods: [],
    capabilities: [],
    fees: { default: undefined, byCurrency: {} },
    credentials: {},
    webhookPath: `/api/payments/webhook/${id}`,
    health: { healthy: false, lastCheckedAt: null, lastError: null, successRate: null, consecutiveFailures: 0 },
  };
}

function mapOutcome(status: string): SandboxRow["outcome"] {
  switch (status) {
    case "CONNECTED": return "PASS";
    case "FAILED": return "FAIL";
    case "MISCONFIGURED": return "NOT CONFIGURED";
    case "UNSUPPORTED": return "UNSUPPORTED";
    default: return "NOT CONFIGURED";
  }
}

async function run(): Promise<SandboxRow[]> {
  const rows: SandboxRow[] = [];
  for (const id of PROVIDERS) {
    // Always a real adapter for these wired providers.
    const adapter = instantiateAdapter(stubConfig(id, "verify"));
    const creds = credsFromEnv(id);
    if (!hasAnyCredential(creds)) {
      rows.push({ provider: id, outcome: "NOT CONFIGURED", detail: "no credentials in environment" });
      continue;
    }
    try {
      const res = await adapter.testConnection(creds);
      rows.push({ provider: id, outcome: mapOutcome(res.status), detail: res.error ? `${res.status}: ${res.error}` : res.status });
    } catch (e) {
      rows.push({ provider: id, outcome: "FAIL", detail: e instanceof Error ? e.message : "connection failed" });
    }
  }
  return rows;
}

async function main(): Promise<void> {
  const rows = await run();
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  console.log("Payment provider sandbox connection report");
  console.log(`${pad("provider", 16)} | ${pad("outcome", 14)} | detail`);
  console.log("-".repeat(72));
  for (const r of rows) {
    console.log(`${pad(r.provider, 16)} | ${pad(r.outcome, 14)} | ${r.detail}`);
  }
  const pass = rows.filter((r) => r.outcome === "PASS").length;
  const fail = rows.filter((r) => r.outcome === "FAIL").length;
  const notConfig = rows.filter((r) => r.outcome === "NOT CONFIGURED").length;
  const unsupported = rows.filter((r) => r.outcome === "UNSUPPORTED").length;
  console.log("-".repeat(72));
  console.log(`PASS ${pass} | FAIL ${fail} | NOT CONFIGURED ${notConfig} | UNSUPPORTED ${unsupported}`);
}

main().catch((err) => {
  console.error("Sandbox harness failed:", err);
  process.exit(1);
});
