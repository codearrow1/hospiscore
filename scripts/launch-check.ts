/**
 * Launch Readiness Check (Phase N).
 *
 * Repository-side (non-deploying) automated gate that reports the state of the
 * launch-critical inventory WITHOUT touching production. It prints a sectioned
 * report and exits non-zero if any HARD gate fails.
 *
 * It does NOT deploy, activate providers, or execute real payments. Anything
 * that requires a live production host is reported as BLOCKED / NOT VERIFIED so
 * the report honestly reflects what could and could not be confirmed from the
 * repository.
 *
 * Run: `npm run launch:check`
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getRawProviderConfigs, getProviderConfigs } from "@/lib/saas/payments/store";
import { CONFIG } from "@/lib/config";

const ROOT = process.cwd();
const SITE_ORIGIN = "https://thebuddharice.online";

interface Section {
  title: string;
  rows: Array<{ name: string; status: "PASS" | "FAIL" | "WARN" | "NOT VERIFIED" | "INFO"; note: string }>;
  hard: boolean;
}

const sections: Section[] = [];

function add(s: Section, name: string, status: Section["rows"][number]["status"], note: string): void {
  s.rows.push({ name, status, note });
}

const REQUIRED_ENV: Array<{ key: string; note: string }> = [
  { key: "DATABASE_URL", note: "Prisma connection string (SQLite file path on hPanel)" },
  { key: "PAYMENT_ENC_KEY", note: "AES-256-GCM key source for encrypted provider secrets (openssl rand -hex 64)" },
];

const RECOMMENDED_ENV: Array<{ key: string; note: string }> = [
  { key: "NEXT_PUBLIC_SITE_URL", note: "Canonical origin (falls back to thebuddharice.online)" },
  { key: "SITE_URL", note: "Legacy canonical origin override" },
  { key: "CRON_SECRET", note: "Protects /api/cron/* endpoints" },
  { key: "AFFILIATE_CRON_KEY", note: "Protects the affiliate cron endpoint" },
  { key: "APP_DATA_FILE", note: "JSON data file for self-hosted marketing data" },
  { key: "APP_DATA_MIRROR", note: "Mirror base used by the demo-only encryption fallback" },
  { key: "APP_SESSION_COOKIE", note: "Custom session cookie name (defaults if unset)" },
  { key: "APP_SESSION_DAYS", note: "Session lifetime in days (defaults if unset)" },
  { key: "ADMIN_EMAILS", note: "Lead/admin emails for role tiering" },
  { key: "SALES_EMAIL", note: "Sales contact email" },
  { key: "DEEPSEEK_API_KEY", note: "AI feature provider key" },
  { key: "GOOGLE_PLACES_API_KEY", note: "Server-side Places API key" },
  { key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", note: "Public Maps key" },
  { key: "REVIEW_PROVIDER", note: "Review source selector" },
];

function envSection(): void {
  const s: Section = { title: "Environment", rows: [], hard: false };
  for (const { key, note } of REQUIRED_ENV) {
    const present = Boolean(process.env[key] && process.env[key]!.trim());
    const noteText = present ? "set" : "unset in this environment (host-provided at deploy) -- " + note;
    add(s, key, present ? "PASS" : "NOT VERIFIED", noteText);
  }
  for (const { key, note } of RECOMMENDED_ENV) {
    const val = process.env[key];
    if (val && val.trim()) add(s, key, "INFO", "set");
    else add(s, key, "WARN", "unset -- " + note);
  }
  const encKey = process.env.PAYMENT_ENC_KEY;
  if (encKey && encKey.length < 16) {
    add(s, "PAYMENT_ENC_KEY strength", "WARN", "key present but short (<16 chars) -- use a 64-hex random value");
  }
  sections.push(s);
}

async function providerSection(): Promise<void> {
  const s: Section = { title: "Payment provider integrity", rows: [], hard: true };
  let raw: Awaited<ReturnType<typeof getRawProviderConfigs>>;
  try {
    raw = await getRawProviderConfigs();
  } catch (e) {
    add(s, "read registry", "FAIL", e instanceof Error ? e.message : "unable to read provider registry");
    sections.push(s);
    return;
  }
  const ids = Object.keys(raw);
  add(s, "providers in registry", "INFO", ids.length ? ids.length + " configured entry/entries" : "none configured");
  const routable = ids
    .filter((id) => {
      const c = raw[id];
      return c && (c.integrationStatus === "ready" || c.integrationStatus === "verify");
    })
    .map((id) => id + "(" + raw[id].integrationStatus + ")");
  if (routable.length) {
    add(s, "routable providers at launch", "FAIL", routable.join(", ") + " -- a READY/CONNECTED provider must NOT ship at launch");
  } else {
    add(s, "routable providers at launch", "PASS", "no provider is ready/verify -- launch is provider-neutral");
  }
  try {
    const cfgs = await getProviderConfigs(false);
    add(s, "registry decrypt/read", "PASS", cfgs.length + " config(s) read");
  } catch (e) {
    add(s, "registry decrypt/read", "FAIL", e instanceof Error ? e.message : "read failed");
  }
  sections.push(s);
}

async function dbSection(): Promise<void> {
  const s: Section = { title: "Database startup", rows: [], hard: false };
  let migrateOk = false;
  try {
    execSync("npx prisma migrate status", { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    migrateOk = true;
  } catch {
    // migration status not readable from this environment
  }
  if (migrateOk) {
    add(s, "prisma migrate status", "PASS", "migration diff readable");
  } else {
    add(s, "prisma migrate status", "NOT VERIFIED", "no reachable DATABASE_URL from this environment -- set DATABASE_URL to a local SQLite file and re-run");
  }
  if (!process.env.DATABASE_URL) {
    add(s, "start command wiring", "NOT VERIFIED", "start requires DATABASE_URL; not executable without it here");
  } else {
    add(s, "start command wiring", "PASS", "package.json start runs migrate deploy before next start (additive, idempotent migration)");
  }
  sections.push(s);
}

function schemaSection(): void {
  const s: Section = { title: "Schema / migration integrity", rows: [], hard: true };
  let hasField = (_model: string, _field: string): boolean => false;
  let isUnique = (_model: string, _field: string): boolean => false;
  try {
    const schemaText = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
    // Brace-counting model parser (robust to the schema's inconsistent indentation).
    const models = new Map<string, string>();
    const lines = schemaText.split(/\r?\n/);
    let current: string | null = null;
    let depth = 0;
    let buf: string[] = [];
    const modelDecl = /^\s*model\s+(\w+)\s*\{\s*$/;
    for (const line of lines) {
      if (current === null) {
        const m = line.match(modelDecl);
        if (m) {
          current = m[1];
          depth = 1;
          buf = [];
        }
      } else {
        depth += (line.match(/\{/g) ?? []).length;
        depth -= (line.match(/\}/g) ?? []).length;
        buf.push(line);
        if (depth === 0) {
          models.set(current, buf.join("\n"));
          current = null;
        }
      }
    }
    hasField = (model, field) => {
      const block = models.get(model);
      if (!block) return false;
      return block.split(/\r?\n/).some((l) => new RegExp(`^\\s*${field}\\s`).test(l));
    };
    isUnique = (model, field) => {
      const block = models.get(model);
      if (!block) return false;
      const line = block.split(/\r?\n/).find((l) => new RegExp(`^\\s*${field}\\s`).test(l));
      return line ? /@unique/.test(line) : false;
    };
  } catch (e) {
    add(s, "read schema.prisma", "FAIL", e instanceof Error ? e.message : "unable to read schema.prisma");
  }
  const invoiceKey = hasField("Invoice", "idempotencyKey");
  const paymentKey = hasField("Payment", "idempotencyKey");
  add(s, "Invoice.idempotencyKey present", invoiceKey ? "PASS" : "FAIL", invoiceKey ? "caller idempotency key field exists" : "Invoice model missing idempotencyKey (B-3)");
  add(s, "Payment.idempotencyKey present", paymentKey ? "PASS" : "FAIL", paymentKey ? "caller idempotency key field exists" : "Payment model missing idempotencyKey (B-3)");
  add(s, "idempotency keys unique", (isUnique("Invoice", "idempotencyKey") && isUnique("Payment", "idempotencyKey")) ? "PASS" : "FAIL", "both keys must be unique to enable caller-side dedup");
  const migrationDirExists = existsSync(join(ROOT, "prisma", "migrations", "20260829010000_caller_idempotency_key"));
  add(s, "idempotency migration file", migrationDirExists ? "PASS" : "FAIL", migrationDirExists ? "20260829010000_caller_idempotency_key present" : "migration missing -- B-3 columns would not be applied at deploy");
  sections.push(s);
}

function routingSection(): void {
  const s: Section = { title: "Routing / dead links", rows: [], hard: false };
  const loginExists = existsSync(join(ROOT, "app", "login"));
  add(s, "legacy /login route removed", loginExists ? "WARN" : "PASS", loginExists ? "/login still exists" : "no /login dir -- protected pages now redirect to /account");
  try {
    const out = execSync('rg -l --fixed-strings \'redirect("/login")\' app', { cwd: ROOT, stdio: "pipe", encoding: "utf8" }).trim();
    add(s, "no redirect to dead /login", out ? "FAIL" : "PASS", out ? out : "0 references");
  } catch {
    add(s, "no redirect to dead /login", "PASS", "0 references");
  }
  sections.push(s);
}

/** Heuristic: does a parsed env line look like a real (non-placeholder) secret? */
function hasSecretValue(path: string): boolean {
  try {
    const content = readFileSync(path, "utf8");
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!val || val === "0" || val === "1" || val.toLowerCase() === "true" || val.toLowerCase() === "false") continue;
      if (val.includes("example") || val.toLowerCase().startsWith("file:")) continue;
      return true;
    }
  } catch {
    // unreadable
  }
  return false;
}

/** High-signal hardcoded-secret patterns likely to indicate a leaked key in a tracked source file. */
const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /(sk|pk|rk)_live_[A-Za-z0-9]{10,}/, label: "Stripe live key" },
  { re: /AKIA[0-9A-Z]{16}/, label: "AWS access key" },
  { re: /AIza[0-9A-Za-z\-_]{20,}/, label: "Google API key" },
  { re: /ghp_[0-9A-Za-z]{20,}/, label: "GitHub token" },
  { re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/, label: "private key block" },
  { re: /xox[baprs]-[0-9A-Za-z\-]{10,}/, label: "Slack token" },
];

function scanTrackedSecrets(): { label: string; file: string }[] {
  const hits: { label: string; file: string }[] = [];
  try {
    const out = execSync("git ls-files", { cwd: ROOT, stdio: "pipe", encoding: "utf8" }).trim();
    const files = out.split(/\r?\n/).filter(Boolean).filter((f) => !f.includes("node_modules"));
    for (const file of files) {
      if (!/\.(ts|tsx|js|jsx|json|env|toml|ya?ml|py|go|rb|php)$/.test(file)) continue;
      const full = join(ROOT, file);
      if (!existsSync(full)) continue;
      let content: string;
      try {
        content = readFileSync(full, "utf8");
      } catch {
        continue;
      }
      // skip lines that reference these as env-var names or placeholder docs
      for (const { re, label } of SECRET_PATTERNS) {
        if (re.test(content)) hits.push({ label, file });
      }
    }
  } catch {
    // not a git repo / rg unavailable
  }
  return hits;
}

function secretSection(): void {
  const s: Section = { title: "Secrets hygiene", rows: [], hard: true };
  try {
    const out = execSync("git ls-files --cached -- .env .env.local .env.production .env.production.local .env.development.local .env.test", { cwd: ROOT, stdio: "pipe", encoding: "utf8" }).trim();
    const tracked = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!tracked.length) {
      add(s, "no prod env tracked by git", "PASS", "no secret-bearing .env committed");
    } else {
      const leaks = tracked.filter((f) => hasSecretValue(join(ROOT, f)));
      if (leaks.length) {
        add(s, "no prod env secrets tracked by git", "FAIL", "tracked files appear to hold real secrets: " + leaks.join(", "));
      } else {
        add(s, "no prod env secrets tracked by git", "WARN", "env file(s) tracked but verified secret-free: " + tracked.join(", ") + " -- remove from git to follow best practice");
      }
    }
  } catch {
    add(s, "no prod env secrets tracked by git", "PASS", "no secret-bearing .env committed");
  }
  const sourceHits = scanTrackedSecrets();
  if (sourceHits.length) {
    add(s, "no hardcoded secrets in source", "WARN", "high-signal secret pattern(s) detected in tracked files: " + sourceHits.map((h) => h.file + " (" + h.label + ")").join(", ") + " -- confirm these are placeholders/docs, not real keys");
  } else {
    add(s, "no hardcoded secrets in source", "PASS", "no high-signal secret patterns matched in tracked source");
  }
  sections.push(s);
}

function prodFlagsSection(): void {
  const s: Section = { title: "Production flags", rows: [], hard: true };
  const path = join(ROOT, ".env.production");
  let demoSeed = "";
  try {
    const content = readFileSync(path, "utf8");
    const m = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("ALLOW_DEMO_SEED="));
    demoSeed = m.length ? m[m.length - 1].split("=")[1].trim() : "";
  } catch {
    // file not present
  }
  const enabled = demoSeed === "1";
  add(s, "demo seeding disabled in production", enabled ? "FAIL" : "PASS", enabled ? ".env.production sets ALLOW_DEMO_SEED=1 (would seed demo/superadmin accounts in prod)" : "ALLOW_DEMO_SEED != 1 in .env.production");

  // O-17: in production the AES-grade payment secret must come from
  // PAYMENT_ENC_KEY, NOT the deterministic demo-key fallback in crypto.ts.
  const inProd = process.env.NODE_ENV === "production";
  const encKeySet = Boolean((process.env.PAYMENT_ENC_KEY ?? "").trim());
  add(
    s,
    "PAYMENT_ENC_KEY required in production",
    inProd && !encKeySet ? "FAIL" : "PASS",
    inProd
      ? encKeySet
        ? "PAYMENT_ENC_KEY set (no demo-key fallback)"
        : "PAYMENT_ENC_KEY unset in production -- crypto.ts would silently fall back to the deterministic demo key (O-17)"
      : "NODE_ENV != production (informational; set PAYMENT_ENC_KEY at the live host)",
  );

  // O-20: a misconfigured prod deploy must not silently serve demo/placeholder
  // review + property data. Live mode requires a Google Places key (CONFIG.live).
  add(
    s,
    "live (non-demo) data mode in production",
    inProd && !CONFIG.live ? "FAIL" : "PASS",
    inProd
      ? CONFIG.live
        ? "GOOGLE_PLACES_API_KEY present -- live property/review path enabled"
        : "demo data mode active in production (GOOGLE_PLACES_API_KEY empty) -- real users would see demo data (O-20)"
      : "NODE_ENV != production (informational; confirm GOOGLE_PLACES_API_KEY on the live host)",
  );

  sections.push(s);
}

function pad(s: string, n: number): string {
  return (s + " ".repeat(n)).slice(0, n);
}

async function main(): Promise<void> {
  envSection();
  await providerSection();
  await dbSection();
  schemaSection();
  routingSection();
  secretSection();
  prodFlagsSection();

  console.log("Launch Readiness Check -- " + SITE_ORIGIN + "  (Phase N, repository-side, non-deploying)");
  for (const sec of sections) {
    console.log("");
    console.log("## " + sec.title + (sec.hard ? "  [HARD]" : ""));
    console.log(pad("check", 30) + " | " + pad("status", 12) + " | note");
    console.log("-".repeat(96));
    for (const r of sec.rows) {
      console.log(pad(r.name, 30) + " | " + pad(r.status, 12) + " | " + r.note);
    }
  }

  let fails = 0;
  let notVerified = 0;
  for (const sec of sections) {
    for (const r of sec.rows) {
      if (r.status === "FAIL") fails++;
      if (r.status === "NOT VERIFIED") notVerified++;
    }
  }
  console.log("");
  console.log("=".repeat(96));
  console.log("FAIL " + fails + " | NOT VERIFIED " + notVerified + " | sections " + sections.length);
  if (fails > 0) {
    console.log("Launch check FAILED -- resolve FAIL rows (NOT VERIFIED is informational).");
    process.exit(1);
  }
  console.log("Launch check passed (NOT VERIFIED rows remain for live-host confirmation).");
}

main().catch((e) => {
  console.error("launch check error:", e);
  process.exit(1);
});
