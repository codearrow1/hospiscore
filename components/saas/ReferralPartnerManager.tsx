"use client";

/**
 * ReferralPartnerManager — shared foundation for the two referral programs
 * (Phase 6). Affiliates refer traffic via links; Partners sell and implement.
 * Both share: lifecycle states, the commission/payout ledger, payout rails and
 * portal claim-token minting. Everything program-specific is gated on the
 * `variant` prop so the two surfaces look related but clearly distinct.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";

export type ReferralVariant = "affiliate" | "partner";

export interface ReferralPerson {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  businessName?: string | null;
  country?: string | null;
  website?: string | null;
  tier: string;
  status: string;
  referralCode: string;
  commissionModel: string;
  commissionValue: number;
  type?: string | null;
}

export interface LedgerRow {
  id: string;
  ownerRef: string;
  amount: number;
  currency: string;
  status: string;
  model?: string | null;
  method?: string | null;
  organizationName?: string | null;
  createdAt: string;
}

interface PortfolioOrg {
  id: string; name: string; mrr: number; country?: string | null; status: string;
}

const TRANSITIONS: Record<string, { to: string; label: string; tone?: "danger" }[]> = {
  applied: [{ to: "review", label: "Start review" }],
  review: [{ to: "approved", label: "Approve" }],
  approved: [{ to: "active", label: "Activate" }],
  active: [{ to: "suspended", label: "Suspend", tone: "danger" }],
  suspended: [{ to: "active", label: "Reinstate" }],
};

const COMMISSION_STATES = [
  ["pending", "Attributed — waiting for the referral's first payment."],
  ["eligible", "First payment received — enters review window."],
  ["approved", "Cleared review — awaiting finance approval."],
  ["payable", "Approved — included in the next payout request."],
  ["paid", "Settled via a payout (FIFO consumption)."],
  ["reversed / rejected / fraud_hold", "Refund, chargeback, early cancellation or fraud flag."],
] as const;

const AFFILIATE_FAQ = [
  ["When do I earn?", "When someone subscribes through your link. The commission model on your account (fixed or % of MRR) decides the amount."],
  ["When can I withdraw?", "Once commissions reach “payable” they count toward your available balance. Request a payout and finance settles it by bank/UPI/PayPal."],
  ["Why did a commission disappear?", "Reversals: refunds, chargebacks, early cancellations or flagged fraud. Reversed commissions are removed from your balance."],
  ["Do repeat clicks count?", "One attribution per lead — repeated submissions never duplicate. One commission per organization."],
];

/** Compact CSS bar chart — monthly earnings in record currency. */
function EarningsChart({ rows }: { rows: LedgerRow[] }) {
  const months = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!["eligible", "approved", "payable", "paid"].includes(r.status)) continue;
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + r.amount);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [rows]);
  if (months.length === 0) {
    return <p className="text-xs text-zinc-400">No earned commissions in the last months yet.</p>;
  }
  const max = Math.max(...months.map((m) => m[1]));
  const label = (key: string) =>
    new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  return (
    <div className="flex h-28 items-end gap-2">
      {months.map(([key, cents]) => (
        <div key={key} className="flex flex-1 flex-col items-center gap-1" title={`${label(key)} · ${formatMoney(cents, "USD")}`}>
          <span className="text-[10px] tabular-nums text-zinc-500">{formatMoney(cents, "USD")}</span>
          <div className="w-full rounded-t bg-indigo-500/80 dark:bg-indigo-400/70" style={{ height: `${Math.max(6, Math.round((cents / max) * 72))}px` }} />
          <span className="text-[10px] text-zinc-400">{label(key)}</span>
        </div>
      ))}
    </div>
  );
}

/** Click → Attribution → Subscription → Commission → Eligibility → Payable → Paid */
function LifecycleStepper({ clicks, rows }: { clicks: number; rows: LedgerRow[] }) {
  const steps = [
    { label: "Clicks", value: String(clicks) },
    { label: "Attribution", value: String(rows.length) },
    { label: "Subscription", value: String(rows.filter((r) => r.organizationName).length) },
    { label: "Commission", value: String(rows.filter((r) => r.amount > 0).length) },
    { label: "Eligible", value: String(rows.filter((r) => ["eligible", "approved"].includes(r.status)).length) },
    { label: "Payable", value: String(rows.filter((r) => r.status === "payable").length) },
    { label: "Paid", value: formatMoney(rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0), "USD") },
  ];
  return (
    <ol className="-mx-1 flex snap-x gap-0 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <li key={s.label} className="flex min-w-24 flex-1 snap-start items-center gap-1 px-1">
          <div className="flex flex-col items-center text-center">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${s.value !== "0" && s.value !== "$0.00" ? "bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>{i + 1}</span>
            <span className="mt-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{s.label}</span>
            <span className="whitespace-nowrap text-xs font-bold tabular-nums">{s.value}</span>
          </div>
          {i < steps.length - 1 && <span aria-hidden className="mb-4 h-px w-auto grow bg-zinc-300 dark:bg-zinc-600" />}
        </li>
      ))}
    </ol>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Copied");
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Copy failed — select manually");
        }
      }}
      className={btnGhost + " !py-1 !text-xs"}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function QrCode({ text }: { text: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((m) => m.toString(text, { type: "svg", margin: 1, width: 128 }))
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, [text]);
  if (!svg) return <div className="h-32 w-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />;
  return <div className="h-32 w-32 shrink-0 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function ReferralPartnerManager({
  variant,
  people,
  commissions,
  payouts,
  canManage,
  canApprove,
  canPayout,
  clicksByPerson = {},
  balances = {},
  portfolioByPerson = {},
}: {
  variant: ReferralVariant;
  people: ReferralPerson[];
  commissions: LedgerRow[];
  payouts: LedgerRow[];
  canManage: boolean;
  canApprove: boolean;
  canPayout: boolean;
  /** affiliate-only: total tracked clicks per person id */
  clicksByPerson?: Record<string, number>;
  /** available payable balance (cents) per person id — mirrors server ledger math */
  balances?: Record<string, number>;
  /** partner-only: referred organizations per person id */
  portfolioByPerson?: Record<string, PortfolioOrg[]>;
}) {
  const router = useRouter();
  const toast = useToast();
  const noun = variant === "affiliate" ? "Affiliate" : "Partner";
  const nounPlural = variant === "affiliate" ? "Affiliates" : "Partners";
  const listApi = variant === "affiliate" ? "/api/saas/affiliates" : "/api/saas/partners";
  const payoutsApi = variant === "affiliate" ? "/api/saas/payouts" : "/api/saas/partners/payouts";
  const statusDomain = variant === "affiliate" ? "affiliate" as const : "partner" as const;

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(
    variant === "affiliate"
      ? { tier: "standard", commissionModel: "percent_mrr_12", commissionValue: "2000" }
      : { type: "reseller", tier: "bronze", commissionModel: "percent_first", commissionValue: "1500" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ReferralPerson | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [claim, setClaim] = useState<{ token: string; expiresAt: string } | null>(null);
  const [minting, setMinting] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const linkFor = (code: string) => `${siteOrigin}/?ref=${code}`;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!needle) return true;
      return [p.name, p.email, p.company, p.businessName, p.referralCode].some((v) => (v ?? "").toLowerCase().includes(needle));
    });
  }, [people, q, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of people) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return counts;
  }, [people]);

  const rowsFor = (id: string) => ({
    commissions: commissions.filter((c) => c.ownerRef === id),
    payouts: payouts.filter((p) => p.ownerRef === id),
  });

  const refresh = async () => {
    const res = await fetch(listApi);
    if (res.ok) router.refresh();
  };

  const create = async () => {
    setBusy(true); setError("");
    try {
      const body =
        variant === "affiliate"
          ? { name: form.name, email: form.email, businessName: form.businessName, country: form.country, website: form.website, tier: form.tier, commissionModel: form.commissionModel, commissionValue: Number(form.commissionValue) }
          : { name: form.name, email: form.email, company: form.company, country: form.country, website: form.website, type: form.type, tier: form.tier, commissionModel: form.commissionModel, commissionValue: Number(form.commissionValue) };
      const res = await fetch(listApi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Create failed"); return; }
      setCreating(false); setForm(variant === "affiliate"
        ? { tier: "standard", commissionModel: "percent_mrr_12", commissionValue: "2000" }
        : { type: "reseller", tier: "bronze", commissionModel: "percent_first", commissionValue: "1500" });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`${listApi}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Update failed"); return; }
    toast.success(`Marked ${status}`);
    refresh();
  };

  const createPayout = async () => {
    if (!detail) return;
    const res = await fetch(payoutsApi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [`${variant}Id`]: detail.id, amount: Number(payoutAmount) }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error ?? "Payout failed"); return; }
    setPayoutAmount("");
    toast.success("Payout requested");
    refresh();
  };

  const mintClaimToken = async () => {
    if (!detail) return;
    setMinting(true);
    try {
      const res = await fetch("/api/saas/portals/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: variant, refId: detail.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Mint failed"); return; }
      setClaim({ token: d.token, expiresAt: d.expiresAt });
    } finally {
      setMinting(false);
    }
  };

  const termsLabel = (p: ReferralPerson) =>
    p.commissionModel === "fixed" ? `fixed ${formatMoney(p.commissionValue, "USD")}` : `${(p.commissionValue / 100).toFixed(1)}% · ${p.commissionModel.replace(/^percent_/, "").replace(/_/g, " ")}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={inputCls + " w-56"}
          placeholder={`Search ${nounPlural.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={`Search ${nounPlural}`}
        />
        <button onClick={() => setStatusFilter("")} className={btnGhost + " !py-1 !text-xs" + (!statusFilter ? " !border-indigo-400 font-semibold" : "")}>
          All ({people.length})
        </button>
        {Object.entries(statusCounts).map(([s, n]) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)} className={btnGhost + " !py-1 !text-xs" + (statusFilter === s ? " !border-indigo-400 font-semibold" : "")}>
            {s} ({n})
          </button>
        ))}
        {canManage && (
          <button onClick={() => setCreating(true)} className={btnPrimary + " ml-auto"}>+ New {noun}</button>
        )}
      </div>

      {/* List */}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="hidden w-full text-left text-sm md:table">
          <thead><tr className="text-xs uppercase text-zinc-400">
            <th className="px-3 py-2">{noun}</th>
            <th className="px-3 py-2">Code</th>
            {variant === "partner" && <th className="px-3 py-2">Type/Tier</th>}
            {variant === "affiliate" && <th className="px-3 py-2">Tier</th>}
            {variant === "partner" && <th className="px-3 py-2">Accounts</th>}
            {variant === "affiliate" && <th className="px-3 py-2">Clicks</th>}
            <th className="px-3 py-2">Terms</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  <button onClick={() => { setDetail(p); setPayoutAmount(""); }} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{p.name}</button>
                  <span className="block text-xs text-zinc-500">{(variant === "affiliate" ? p.businessName : p.company) ?? p.email} · {p.country || "—"}</span>
                </td>
                <td className="px-3 py-2"><span className="font-mono text-xs">{p.referralCode}</span></td>
                {variant === "partner" && <td className="px-3 py-2 text-xs capitalize">{p.type?.replace(/_/g, " ")} / {p.tier}</td>}
                {variant === "affiliate" && <td className="px-3 py-2 text-xs">{p.tier}</td>}
                {variant === "partner" && <td className="px-3 py-2 text-xs tabular-nums">{(portfolioByPerson[p.id] ?? []).length}</td>}
                {variant === "affiliate" && <td className="px-3 py-2 text-xs tabular-nums">{clicksByPerson[p.id] ?? 0}</td>}
                <td className="px-3 py-2 text-xs">{termsLabel(p)}</td>
                <td className="px-3 py-2"><StatusBadge domain={statusDomain} status={p.status} /></td>
                <td className="px-3 py-2 space-x-1 whitespace-nowrap">
                  {(TRANSITIONS[p.status] ?? []).map((t) =>
                    canApprove ? (
                      <button key={t.to} onClick={() => setStatus(p.id, t.to)} className={t.tone === "danger" ? "rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 dark:border-red-900" : btnGhost}>{t.label}</button>
                    ) : null,
                  )}
                  <button onClick={() => { setDetail(p); setPayoutAmount(""); }} className={btnGhost}>Details</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-zinc-400">No {nounPlural.toLowerCase()} match.</td></tr>}
          </tbody>
        </table>
        {/* Mobile cards */}
        <ul className="divide-y md:hidden">
          {filtered.map((p) => (
            <li key={p.id} className="space-y-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => { setDetail(p); setPayoutAmount(""); }} className="font-medium text-indigo-600 dark:text-indigo-400">{p.name}</button>
                <StatusBadge domain={statusDomain} status={p.status} />
              </div>
              <p className="text-xs text-zinc-500">{p.email} · {p.referralCode}</p>
              <p className="text-xs text-zinc-500">{termsLabel(p)}{variant === "affiliate" ? ` · ${clicksByPerson[p.id] ?? 0} clicks` : ` · ${(portfolioByPerson[p.id] ?? []).length} accounts`}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(TRANSITIONS[p.status] ?? []).map((t) =>
                  canApprove ? (
                    <button key={t.to} onClick={() => setStatus(p.id, t.to)} className={t.tone === "danger" ? "rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 dark:border-red-900" : btnGhost}>{t.label}</button>
                  ) : null,
                )}
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="p-6 text-center text-sm text-zinc-400">No {nounPlural.toLowerCase()} match.</li>}
        </ul>
      </div>

      {/* Details */}
      <Modal open={Boolean(detail)} onClose={() => { setDetail(null); setClaim(null); }} title={detail ? `${noun}: ${detail.name}` : ""}>
        {detail && (() => {
          const { commissions: pc, payouts: pp } = rowsFor(detail.id);
          const balance = balances[detail.id] ?? 0;
          const orgs = portfolioByPerson[detail.id] ?? [];
          const mrrInfluence = orgs.reduce((s, o) => s + o.mrr, 0);
          return (
            <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
              {/* Profile */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-xs text-zinc-500">Email</dt><dd className="break-all">{detail.email}</dd>
                <dt className="text-xs text-zinc-500">{variant === "affiliate" ? "Business" : "Company"}</dt><dd>{(variant === "affiliate" ? detail.businessName : detail.company) ?? "—"}</dd>
                <dt className="text-xs text-zinc-500">Country</dt><dd>{detail.country ?? "—"}</dd>
                {detail.website && (<><dt className="text-xs text-zinc-500">Website</dt><dd className="break-all">{detail.website}</dd></>)}
                {variant === "partner" && (<><dt className="text-xs text-zinc-500">Type</dt><dd className="capitalize">{detail.type?.replace(/_/g, " ")}</dd></>)}
                <dt className="text-xs text-zinc-500">Tier</dt><dd className="capitalize">{detail.tier}</dd>
                <dt className="text-xs text-zinc-500">Commission</dt><dd>{termsLabel(detail)}</dd>
              </dl>

              {/* Referral link (+QR for affiliates) */}
              <div className={`gap-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800 ${variant === "affiliate" ? "flex items-start justify-between" : ""}`}>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Referral link</p>
                  <code className="mt-1 block break-all text-xs">{linkFor(detail.referralCode)}</code>
                  <div className="mt-1.5"><CopyButton text={linkFor(detail.referralCode)} label="Copy link" /></div>
                </div>
                {variant === "affiliate" && <QrCode text={linkFor(detail.referralCode)} />}
              </div>

              {/* Affiliate: lifecycle stepper + earnings chart */}
              {variant === "affiliate" && (
                <>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Funnel — click to paid</p>
                    <LifecycleStepper clicks={clicksByPerson[detail.id] ?? 0} rows={pc} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Earnings (last 6 months)</p>
                    <EarningsChart rows={pc} />
                  </div>
                </>
              )}

              {/* Partner: portfolio + implementation context */}
              {variant === "partner" && (
                <>
                  <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Portfolio — referred accounts ({orgs.length}) · MRR influence {formatMoney(mrrInfluence, "USD")}</p>
                    {orgs.length === 0 ? (
                      <p className="text-xs text-zinc-400">No referred organizations yet.</p>
                    ) : (
                      <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                        {orgs.map((o) => (
                          <li key={o.id} className="flex items-center justify-between py-1.5">
                            <span className="min-w-0 truncate font-medium">{o.name}<span className="ml-1.5 text-xs text-zinc-400">{o.country ?? ""}</span></span>
                            <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">MRR {formatMoney(o.mrr, "USD")}<StatusBadge domain="organization" status={o.status} /></span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                    <p className="font-bold uppercase tracking-wider">Implementation context</p>
                    <p className="mt-1">
                      Partners actively sell and implement HospiOS at customer sites ({detail.type?.replace(/_/g, " ")}, tier {detail.tier}). Commissions are booked when a referred organization&apos;s subscription activates — one commission per organization.
                    </p>
                    <p className="mt-1 italic opacity-80">Team management and a co-selling pipeline are not modeled yet — this view only reflects recorded referrals and ledger data.</p>
                  </div>
                </>
              )}

              {/* Eligibility explainer */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-bold uppercase tracking-wider">Payout eligibility</p>
                <p className="mt-1">
                  Available balance <strong>{formatMoney(balance, "USD")}</strong> = unpaid remainder of <em>payable</em> commissions minus amounts locked by open payouts.
                  Commissions become eligible after the referral pays, then move approved → payable. Payout lifecycle: requested → approved → processing → paid.
                </p>
              </div>

              {/* Commissions */}
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Commissions ({pc.length})</p>
                {pc.length === 0 ? <p className="text-xs text-zinc-400">Nothing attributed yet.</p> : (
                  <table className="w-full text-left text-xs">
                    <thead><tr className="uppercase text-zinc-400"><th className="py-1">When</th>{variant === "partner" && <th className="py-1">Account</th>}<th className="py-1">Model</th><th className="py-1 text-right">Amount</th><th className="py-1">State</th></tr></thead>
                    <tbody>
                      {pc.slice(0, 12).map((c) => (
                        <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="py-1 pr-2">{new Date(c.createdAt).toLocaleDateString()}</td>
                          {variant === "partner" && <td className="max-w-28 truncate py-1 pr-2">{c.organizationName ?? "—"}</td>}
                          <td className="py-1 pr-2">{c.model?.replace(/_/g, " ")}</td>
                          <td className="py-1 text-right tabular-nums">{formatMoney(c.amount, c.currency)}</td>
                          <td className="py-1"><StatusBadge domain="commission" status={c.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-zinc-400 hover:text-zinc-600">What each state means</summary>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
                    {COMMISSION_STATES.map(([s, why]) => (
                      <li key={s}><StatusBadge domain="commission" status={s.split(" ")[0]} /> {why}</li>
                    ))}
                  </ul>
                </details>
              </div>

              {/* Payouts + request */}
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Payout history ({pp.length})</p>
                {pp.length === 0 ? <p className="text-xs text-zinc-400">No payouts yet.</p> : (
                  <table className="w-full text-left text-xs">
                    <thead><tr className="uppercase text-zinc-400"><th className="py-1">When</th><th className="py-1">Method</th><th className="py-1 text-right">Amount</th><th className="py-1">State</th></tr></thead>
                    <tbody>
                      {pp.slice(0, 12).map((p) => (
                        <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="py-1 pr-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                          <td className="py-1 pr-2 uppercase">{p.method ?? "—"}</td>
                          <td className="py-1 text-right tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                          <td className="py-1"><StatusBadge domain="payout" status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {canPayout && (
                  <div className="mt-2 flex items-end gap-2">
                    <Field label={`Request payout (available ${formatMoney(balance, "USD")})`}>
                      <input className={inputCls + " !w-36"} type="number" placeholder="cents" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                    </Field>
                    <button className={btnPrimary + " mb-0.5"} disabled={!Number(payoutAmount)} onClick={createPayout}>Request</button>
                    {balance > 0 && (
                      <button className={btnGhost + " mb-0.5"} onClick={() => setPayoutAmount(String(balance))} title="Fill full available balance">Max</button>
                    )}
                  </div>
                )}
              </div>

              {/* Portal access — claim token minting */}
              {canManage && (
                <div className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Portal access</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Mint a one-time claim token so {detail.name} can register and bind this {noun.toLowerCase()} identity to their own login. Shown once, valid 15 minutes.
                  </p>
                  <button className={btnGhost + " mt-2"} disabled={minting} onClick={mintClaimToken}>{minting ? "Minting…" : "Mint claim token"}</button>
                  {claim && (
                    <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/40">
                      <code className="block break-all font-mono text-xs font-bold text-emerald-900 dark:text-emerald-200">{claim.token}</code>
                      <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                        Expires {new Date(claim.expiresAt).toLocaleTimeString()} — copy now, it will not be shown again.
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <CopyButton text={claim.token} label="Copy token" />
                        <CopyButton text={`${siteOrigin}/account?claim=${encodeURIComponent(claim.token)}`} label="Copy registration link" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Create modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title={`New ${noun}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required><input className={inputCls} value={form.name ?? ""} onChange={set("name")} /></Field>
            <Field label="Email" required><input className={inputCls} type="email" value={form.email ?? ""} onChange={set("email")} /></Field>
            {variant === "affiliate"
              ? <Field label="Business"><input className={inputCls} value={form.businessName ?? ""} onChange={set("businessName")} /></Field>
              : <Field label="Company"><input className={inputCls} value={form.company ?? ""} onChange={set("company")} /></Field>}
            <Field label="Country"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={set("country")} /></Field>
            <Field label="Website"><input className={inputCls} value={form.website ?? ""} onChange={set("website")} /></Field>
            {variant === "partner" && (
              <Field label="Type">
                <select className={inputCls} value={form.type} onChange={set("type")}>
                  <option value="it_agency">IT agency</option><option value="consultant">consultant</option>
                  <option value="reseller">reseller</option><option value="implementation">implementation</option>
                  <option value="hmc">hotel mgmt company</option>
                </select>
              </Field>
            )}
            <Field label="Tier">
              <select className={inputCls} value={form.tier} onChange={set("tier")}>
                {variant === "affiliate"
                  ? <><option value="standard">standard</option><option value="silver">silver</option><option value="gold">gold</option><option value="platinum">platinum</option></>
                  : <><option value="bronze">bronze</option><option value="silver">silver</option><option value="gold">gold</option><option value="platinum">platinum</option></>}
              </select>
            </Field>
            <Field label="Commission model">
              <select className={inputCls} value={form.commissionModel} onChange={set("commissionModel")}>
                <option value="fixed">fixed</option>
                <option value="percent_first">% first payment</option>
                <option value="percent_mrr_12">% of 12mo MRR</option>
                <option value="percent_mrr_recurring">recurring %</option>
              </select>
            </Field>
            <Field label="Value (cents/bps)"><input className={inputCls} type="number" value={form.commissionValue ?? ""} onChange={set("commissionValue")} /></Field>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setCreating(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy || !form.name || !form.email} onClick={create}>{busy ? "Creating…" : "Create"}</button>
          </div>
        </div>
      </Modal>

      {/* Claim token reveal (after the details modal closed) */}
      {claim && !detail && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-300 bg-white p-4 shadow-xl dark:border-emerald-800 dark:bg-zinc-900">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Claim token — shown once</p>
          <code className="mt-1.5 block break-all font-mono text-sm font-bold">{claim.token}</code>
          <p className="mt-1 text-[11px] text-zinc-500">Expires {new Date(claim.expiresAt).toLocaleTimeString()}. Hand it to the program member out-of-band.</p>
          <div className="mt-2 flex justify-end"><CopyButton text={claim.token} label="Copy token" /></div>
        </div>
      )}

      {/* Affiliate resources / FAQ */}
      {variant === "affiliate" && (
        <details className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-bold">Affiliate resources &amp; FAQ</summary>
          <ul className="mt-3 space-y-2.5">
            {AFFILIATE_FAQ.map(([q2, a]) => (
              <li key={q2} className="text-sm">
                <p className="font-semibold">{q2}</p>
                <p className="text-xs text-zinc-500">{a}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
            Program cheat-sheet: share your link → we track the click → their first payment books your commission → payable after review → settled by payout run.
          </p>
        </details>
      )}
    </div>
  );
}
