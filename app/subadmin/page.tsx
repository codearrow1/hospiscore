import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { canAccess, ROLE_LABELS, roleFor } from "@/lib/marketing/roles";
import { readData } from "@/lib/db";
import Header from "@/components/Header";
import { SectionCard, Badge, EmptyState } from "@/components/marketing-admin/ui";
import { PIPELINE_STAGES } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Subadmin dashboard — the former Marketing Admin home. Marketing/operations
 * scope only; SaaS owner controls live under /saas for Super Admin.
 */
export default async function SubadminDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/subadmin");
  if (!canAccess(user)) redirect("/account?next=/subadmin");

  const data = await readData();
  const leads = data.leads ?? [];
  const campaigns = data.campaigns ?? [];
  const now = Date.now();
  const d30 = now - 30 * 86_400_000;
  const last30 = leads.filter((l) => new Date(l.createdAt).getTime() >= d30);
  const won = leads.filter((l) => l.stage === "won");
  const convRate = leads.length ? Math.round((won.length / leads.length) * 100) : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const recent = [...leads]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const role = roleFor(user);

  const kpis: { label: string; value: string; hint?: string }[] = [
    { label: "Total leads", value: String(leads.length) },
    { label: "Leads (30d)", value: String(last30.length) },
    { label: "Won", value: String(won.length), hint: `${convRate}% conversion` },
    { label: "Active campaigns", value: String(activeCampaigns.length) },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Subadmin Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Marketing &amp; sales operations{role ? ` — ${ROLE_LABELS[role]}` : ""}
            </p>
          </div>
          <Badge>Marketing scope</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <SectionCard key={k.label}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">{k.label}</p>
              <p className="mt-1 text-2xl font-semibold">{k.value}</p>
              {k.hint ? <p className="text-xs text-zinc-500">{k.hint}</p> : null}
            </SectionCard>
          ))}
        </div>

        <SectionCard title="Pipeline by stage">
          {leads.length === 0 ? (
            <EmptyState title="No leads yet." />
          ) : (
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              {PIPELINE_STAGES.map((s) => {
                const n = leads.filter((l) => l.stage === s).length;
                return (
                  <li key={s} className="rounded-md border border-zinc-200 px-2 py-1.5">
                    <span className="font-medium">{n}</span>{" "}
                    <span className="text-zinc-500">{s.replace(/_/g, " ")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent leads">
          {recent.length === 0 ? (
            <EmptyState title="Nothing here yet." />
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {recent.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-medium">{l.name}</span>
                    <span className="text-zinc-500"> · {l.company || l.email}</span>
                  </span>
                  <Badge>{l.stage.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <p className="text-xs text-zinc-500">
          Full CRM lives in{" "}
          <Link className="underline" href="/marketing-admin/leads">Marketing Admin → Leads</Link>.
        </p>
      </main>
    </div>
  );
}
