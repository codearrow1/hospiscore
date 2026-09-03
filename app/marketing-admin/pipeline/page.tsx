import { requireCapability } from "@/lib/marketing/guard";
import {
  hasCapability,
  MARKETING_CAPABILITIES,
  ROLE_CAPABILITIES,
  roleFor,
} from "@/lib/marketing/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import {
  listLeads,
  listConvertedCustomers,
} from "@/lib/marketing/leads";
import { listUsers } from "@/lib/marketing/users";
import { readData } from "@/lib/db";
import { isLeadStage } from "@/lib/marketing/stages";
import {
  buildViewModel,
  isDemoLeadId,
  stageWinWeights,
  wonThisMonth,
} from "@/lib/marketing/pipeline";
import type { LeadStage } from "@/lib/marketing/types";
import PipelineClient from "@/components/marketing-admin/pipeline/PipelineClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function roleCapabilities(user: { email: string; role?: string }): string[] {
  const role = roleFor(user);
  if (!role) return [];
  return MARKETING_CAPABILITIES.filter((c) =>
    (ROLE_CAPABILITIES[role] as ReadonlySet<string>).has(c),
  );
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) {
    return restrictedPanel("Pipeline", "You need leads.read permission to view the sales pipeline.");
  }
  await ensureMarketingStore();

  const sp = await searchParams;
  const stage = isLeadStage(sp.stage ?? "") ? (sp.stage as LeadStage) : undefined;

  const [leads, users, converted, data] = await Promise.all([
    listLeads(),
    listUsers(),
    listConvertedCustomers(),
    readData(),
  ]);

  // Sales reps see only the deals owned by them — mirrors the hard scope on
  // GET /api/marketing/leads so the board can never leak other people's deals.
  const canManage = hasCapability(guard.user, "leads.manage");
  const accessible = canManage
    ? leads
    : leads.filter((l) => (l.ownerEmail ?? "").toLowerCase() === guard.user.email.toLowerCase());

  // Leads converted to customers live in the customer plane, not the board.
  const boardLeads = accessible.filter((l) => !l.convertedCustomerId);

  const deals = buildViewModel(boardLeads, { users });

  const { weights } = stageWinWeights(accessible, data.leadEvents ?? []);
  const wonThisMonthCount = wonThisMonth(
    deals,
    converted.map((c) => c.convertedAt),
  );

  const ownersUsed = [
    ...new Map(
      boardLeads
        .filter((l) => l.ownerEmail)
        .map((l) => {
          const email = (l.ownerEmail as string).toLowerCase();
          const member = users.find((u) => u.email.toLowerCase() === email);
          return [email, { email, name: member?.name ?? email }] as const;
        }),
    ).values(),
  ];

  const sourcesUsed = [...new Set(boardLeads.map((l) => l.source))].sort();
  const currenciesUsed = [
    ...new Set(boardLeads.map((l) => (l.estimatedValueCurrency ?? "USD").toUpperCase())),
  ].sort();

  const demoCount = boardLeads.filter((l) => isDemoLeadId(l.id)).length;
  const demoDefaultExclude = process.env.NODE_ENV === "production";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Pipeline</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Drag a card forward (or use its stage picker) to advance a deal. Move to <span className="font-semibold">Won</span> to
          close, or <span className="font-semibold">Lost</span> with a recorded reason. Press{" "}
          <kbd className="rounded border border-line bg-surface-subtle px-1.5 py-0.5 text-[11px] font-semibold">/</kbd> to search.
        </p>
      </div>

      <PipelineClient
        snapshot={{
          deals,
          users,
          ownersUsed,
          sourcesUsed,
          currenciesUsed,
          weights,
          wonThisMonth: wonThisMonthCount,
          capabilities: roleCapabilities(guard.user),
          demoCount,
          demoDefaultExclude,
          initialStage: stage,
        }}
      />
    </div>
  );
}