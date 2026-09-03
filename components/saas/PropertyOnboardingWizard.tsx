"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Badge,
  btnGhost,
  btnPrimary,
  EmptyState,
  Field,
  inputCls,
  SectionCard,
} from "@/components/marketing-admin/ui";

interface DiscoveredMatch {
  placeId: string;
  name: string;
  address: string;
  types: string[];
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  match: {
    status: "none" | "linked" | "duplicate";
    reason?: string;
    propertyId?: string;
    propertyName?: string;
    organizationId?: string;
    organizationName?: string;
  };
}

interface OrgOption {
  id: string;
  legalName: string;
  businessName: string | null;
}

const STEPS = [
  "Discover",
  "Review match",
  "Organization",
  "Enrich",
  "Attribution",
  "Confirm",
  "Verification",
  "Done",
];

function statusTone(status: string): string {
  return status === "none"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
    : status === "duplicate"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

const GREEN_BADGE = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300";

export default function PropertyOnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DiscoveredMatch[]>([]);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<DiscoveredMatch | null>(null);

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [orgMode, setOrgMode] = useState<"select" | "create">("select");
  const [orgId, setOrgId] = useState("");
  const [newOrg, setNewOrg] = useState<Record<string, string>>({});

  const [attribution, setAttribution] = useState<Record<string, string>>({});

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [result, setResult] = useState<{ status: string; property?: { id: string; name: string; organizationId: string } } | null>(null);

  const loadOrgs = async () => {
    if (orgsLoaded) return;
    try {
      const res = await fetch("/api/saas/organizations?q=");
      const data = await res.json().catch(() => ({}));
      const list: OrgOption[] = (data.organizations ?? []).map((o: { id: string; legalName: string; businessName: string | null }) => ({
        id: o.id,
        legalName: o.legalName,
        businessName: o.businessName,
      }));
      setOrgs(list);
    } finally {
      setOrgsLoaded(true);
    }
  };

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setSelected(null);
    try {
      const res = await fetch(`/api/saas/properties/discover?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchError(data.error ?? "Discovery failed");
      } else {
        setResults(data.matches ?? []);
        if ((data.matches ?? []).length === 0) setSearchError("No properties found on Google for that query.");
      }
    } catch {
      setSearchError("Could not reach the discovery service.");
    } finally {
      setSearching(false);
    }
  };

  const pickMatch = (m: DiscoveredMatch) => {
    setSelected(m);
    setStep(1);
  };

  const submitImport = async (force = false) => {
    if (!selected) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/saas/properties/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: selected.placeId,
          organizationId: orgMode === "select" && orgId ? orgId : undefined,
          newOrg: orgMode === "create" ? { legalName: newOrg.legalName, businessName: newOrg.businessName, country: newOrg.country } : undefined,
          attribution: {
            acquisitionSource: attribution.source || undefined,
            acquisitionCampaign: attribution.campaign || undefined,
          },
          force,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.forceRequired || (data.error && /duplicate/i.test(data.error))) {
          setImportError(`${data.error ?? "Duplicate detected."} Import anyway?`);
          if (window.confirm(`${data.error ?? "This looks like a duplicate."} Import anyway?`)) {
            return submitImport(true);
          }
          return;
        }
        setImportError(data.error ?? "Import failed");
        return;
      }
      setResult(data);
      setStep(6);
      router.refresh();
    } finally {
      setImporting(false);
    }
  };

  const footer = () => (
    <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <button className={btnGhost} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
        Back
      </button>
      {step < STEPS.length - 1 && step !== 5 && (
        <button className={btnPrimary} onClick={() => setStep((s) => s + 1)}>
          Next
        </button>
      )}
    </div>
  );

  return (
    <SectionCard title="Google → Property onboarding">
      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2 py-0.5 ${
                i === step
                  ? "bg-indigo-600 text-white"
                  : i < step
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
              }`}
            >
              {i + 1}. {label}
            </span>
            {i < STEPS.length - 1 && <span className="text-zinc-300">→</span>}
          </li>
        ))}
      </ol>

      {/* STEP 0: Discover */}
      {step === 0 && (
        <div className="space-y-4">
          <form className="flex gap-2" onSubmit={runSearch}>
            <input
              className={inputCls}
              placeholder="Search Google for a property, e.g. 'boutique hotel lisbon'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={searching}
            />
            <button type="submit" className={btnPrimary} disabled={searching || !query.trim()}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError && <p className="text-sm text-red-500">{searchError}</p>}
          {results.length > 0 && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((m) => (
                <li key={m.placeId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-zinc-500">{m.address}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge className={statusTone(m.match.status)}>
                        {m.match.status === "none" ? "New" : m.match.status === "linked" ? "Linked" : "Duplicate"}
                      </Badge>
                      {m.rating != null && (
                        <Badge className={GREEN_BADGE}>★ {m.rating.toFixed(1)} ({m.userRatingCount ?? 0})</Badge>
                      )}
                    </div>
                  </div>
                  <button className={btnGhost} onClick={() => pickMatch(m)}>
                    Select
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && results.length === 0 && !searchError && (
            <EmptyState title="No results yet" body="Enter a query to discover Google listings, matched against your existing properties." />
          )}
          {footer()}
        </div>
      )}

      {/* STEP 1: Review match */}
      {step === 1 && selected && (
        <div className="space-y-4">
          <Field label="Property">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              <p className="font-medium">{selected.name}</p>
              <p className="text-zinc-500">{selected.address}</p>
              {selected.websiteUri && <p className="truncate text-xs text-zinc-400">{selected.websiteUri}</p>}
            </div>
          </Field>
          <Field label="Match status">
            <div className={`rounded-lg border p-3 text-sm ${
              selected.match.status === "none"
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
            }`}>
              <Badge className={statusTone(selected.match.status)}>
                {selected.match.status === "none" ? "New import" : selected.match.status === "linked" ? "Already linked" : "Possible duplicate"}
              </Badge>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{selected.match.reason}</p>
              {selected.match.status !== "none" && selected.match.propertyId && (
                <a className="mt-1 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400" href={`/saas/organizations/${selected.match.organizationId}`}>
                  View existing: {selected.match.propertyName} ({selected.match.organizationName})
                </a>
              )}
            </div>
          </Field>
          {footer()}
        </div>
      )}

      {/* STEP 2: Organization */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button className={orgMode === "select" ? btnPrimary : btnGhost} onClick={() => setOrgMode("select")}>
              Existing organization
            </button>
            <button className={orgMode === "create" ? btnPrimary : btnGhost} onClick={() => setOrgMode("create")}>
              Create new
            </button>
          </div>
          {orgMode === "select" ? (
            <>
              <button className={btnGhost} onClick={loadOrgs}>
                {orgsLoaded ? "Reload organizations" : "Load organizations"}
              </button>
              {orgsLoaded && (
                <Field label="Organization" required>
                  <select className={inputCls} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                    <option value="">Select…</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.legalName}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {orgsLoaded && orgs.length === 0 && <p className="text-sm text-zinc-500">No organizations yet — create one first.</p>}
            </>
          ) : (
            <div className="space-y-3">
              <Field label="Legal Name" required>
                <input className={inputCls} value={newOrg.legalName ?? ""} onChange={(e) => setNewOrg((f) => ({ ...f, legalName: e.target.value }))} />
              </Field>
              <Field label="Business Name">
                <input className={inputCls} value={newOrg.businessName ?? ""} onChange={(e) => setNewOrg((f) => ({ ...f, businessName: e.target.value }))} />
              </Field>
              <Field label="Country (ISO2)">
                <input className={inputCls} maxLength={2} value={newOrg.country ?? ""} onChange={(e) => setNewOrg((f) => ({ ...f, country: e.target.value }))} />
              </Field>
            </div>
          )}
          {footer()}
        </div>
      )}

      {/* STEP 3: Enrich */}
      {step === 3 && selected && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Field-masked Place Details will be fetched server-side on import. Review the identity below.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">{selected.name}</div></Field>
            <Field label="Address"><div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">{selected.address}</div></Field>
            <Field label="Website"><div className="truncate rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">{selected.websiteUri ?? "—"}</div></Field>
            <Field label="Rating"><div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">{selected.rating != null ? `★ ${selected.rating.toFixed(1)} (${selected.userRatingCount} reviews)` : "—"}</div></Field>
          </div>
          {footer()}
        </div>
      )}

      {/* STEP 4: Attribution */}
      {step === 4 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Optional acquisition context recorded on the organization.</p>
          <Field label="Acquisition Source">
            <input className={inputCls} value={attribution.source ?? ""} onChange={(e) => setAttribution((f) => ({ ...f, source: e.target.value }))} placeholder="e.g. google-ads" />
          </Field>
          <Field label="Acquisition Campaign">
            <input className={inputCls} value={attribution.campaign ?? ""} onChange={(e) => setAttribution((f) => ({ ...f, campaign: e.target.value }))} />
          </Field>
          {footer()}
        </div>
      )}

      {/* STEP 5: Confirm & import */}
      {step === 5 && selected && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Import <span className="font-medium text-zinc-900 dark:text-zinc-100">{selected.name}</span>
            {orgMode === "select" && orgId ? " into the selected organization" : " into a new organization"}.
          </p>
          {importError && <p className="text-sm text-red-500">{importError}</p>}
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={importing || (orgMode === "select" && !orgId) || (orgMode === "create" && !newOrg.legalName)} onClick={() => submitImport()}>
              {importing ? "Importing…" : "Import property"}
            </button>
          </div>
          {footer()}
        </div>
      )}

      {/* STEP 6: Verification note */}
      {step === 6 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            This property is now linked to its Google listing (Place ID) internally. Ownership proof uses the existing
            claim/verification system: a customer can claim the listing and complete phone/email OTP verification before an
            admin approves.
          </p>
          <div className="flex gap-2">
            <a className={btnGhost} href="/saas/claims">Open Claims inbox</a>
            <button className={btnPrimary} onClick={() => setStep(7)}>Continue</button>
          </div>
        </div>
      )}

      {/* STEP 7: Done */}
      {step === 7 && result && (
        <div className="space-y-4">
          <Badge className={GREEN_BADGE}>Import complete</Badge>
          <p className="text-sm">
            {result.status === "reused" ? "This Google listing was already a HospiOS property — no duplicate was created." : `${result.property?.name} was imported and linked to its Google listing.`}
          </p>
          {result.property && (
            <a className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400" href={`/saas/organizations/${result.property.organizationId}`}>
              View organization
            </a>
          )}
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={() => { setStep(0); setResults([]); setSelected(null); setOrgId(""); setNewOrg({}); setAttribution({}); setResult(null); setImportError(""); }}>
              Start another import
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
