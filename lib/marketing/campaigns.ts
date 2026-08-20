/**
 * Campaign management (Phase 19) + attribution. A campaign is a named, dated
 * marketing effort; leads attach to it via UTM campaign, sourceDetail or the
 * landing page they converted on. Reporting aggregates real captured data and
 * never fabricates metrics.
 */

import { randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import type { Campaign, MarketingLead } from "./types";
import { listLeads, listConvertedCustomers } from "./leads";

export interface CampaignInput {
  name: string;
  channel: string;
  audience?: string;
  country?: string;
  landingPage?: string;
  utmCampaign?: string;
  startAt?: string;
  endAt?: string;
  budget?: number;
  status?: Campaign["status"];
}

export async function createCampaign(input: CampaignInput, target?: string): Promise<Campaign> {
  const campaign: Campaign = {
    id: randomUUID(),
    name: input.name.trim(),
    channel: input.channel.trim() || "other",
    audience: input.audience,
    country: input.country?.toUpperCase(),
    landingPage: input.landingPage,
    utmCampaign: input.utmCampaign,
    startAt: input.startAt,
    endAt: input.endAt,
    budget: input.budget,
    status: input.status ?? "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeData(
    (d) => ({
      ...d,
      campaigns: [...(d.campaigns ?? []), campaign],
    }),
    target,
  );
  return campaign;
}

export async function listCampaigns(target?: string): Promise<Campaign[]> {
  const data = await readData(target);
  return (data.campaigns ?? []).sort(
    (a, b) => Date.parse(b.startAt ?? b.createdAt) - Date.parse(a.startAt ?? a.createdAt),
  );
}

export async function getCampaign(id: string, target?: string): Promise<Campaign | null> {
  const data = await readData(target);
  return (data.campaigns ?? []).find((c) => c.id === id) ?? null;
}

export interface CampaignPatch {
  name?: string;
  channel?: string;
  audience?: string;
  country?: string;
  landingPage?: string;
  utmCampaign?: string;
  startAt?: string;
  endAt?: string;
  budget?: number;
  status?: Campaign["status"];
}

export async function updateCampaign(
  id: string,
  patch: CampaignPatch,
  target?: string,
): Promise<Campaign | null> {
  const campaign = await getCampaign(id, target);
  if (!campaign) return null;
  const updated: Campaign = {
    ...campaign,
    ...patch,
    country: patch.country ? patch.country.toUpperCase() : campaign.country,
    updatedAt: new Date().toISOString(),
  };
  await writeData(
    (d) => ({
      ...d,
      campaigns: (d.campaigns ?? []).map((c) => (c.id === id ? updated : c)),
    }),
    target,
  );
  return updated;
}

export async function deleteCampaign(id: string, target?: string): Promise<boolean> {
  let removed = false;
  await writeData(
    (d) => {
      const before = (d.campaigns ?? []).length;
      d.campaigns = (d.campaigns ?? []).filter((c) => c.id !== id);
      removed = before !== (d.campaigns?.length ?? 0);
      return d;
    },
    target,
  );
  return removed;
}

/** Does a lead belong to this campaign by UTM, detail or landing page? */
export function leadInCampaign(lead: MarketingLead, campaign: Campaign): boolean {
  if (campaign.utmCampaign) {
    if ((lead.attribution.campaign ?? "").toLowerCase() === campaign.utmCampaign.toLowerCase()) return true;
  }
  if (campaign.utmCampaign && (lead.attribution?.sourceDetail ?? "").toLowerCase().includes(campaign.utmCampaign.toLowerCase())) return true;
  if (campaign.landingPage && lead.attribution.pagePath?.startsWith(campaign.landingPage)) return true;
  if (campaign.landingPage && lead.attribution.landing?.includes(campaign.landingPage)) return true;
  return false;
}

export interface CampaignStats {
  id: string;
  name: string;
  status: Campaign["status"];
  leads: number;
  demos: number;
  trials: number;
  conversions: number;
  pipelineValue: number;
}

/** Real attribution roll-up for every campaign (from stored leads/demos). */
export async function campaignStats(
  leads?: readonly MarketingLead[],
  target?: string,
): Promise<CampaignStats[]> {
  const all = leads ?? (await listLeads(target));
  const customers = await listConvertedCustomers(target);
  const campaigns = await listCampaigns(target);

  return campaigns.map((c) => {
    const matches = all.filter((l) => leadInCampaign(l, c));
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      leads: matches.length,
      demos: matches.filter((l) => l.stage === "demo_booked" || l.stage === "demo_completed").length,
      trials: matches.filter((l) => l.trialStartedAt != null || l.stage === "trial").length,
      conversions: matches.filter((l) => hasCustomerEntry(customers, l)).length,
      pipelineValue: matches.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0),
    };
  });
}

function hasCustomerEntry(
  customers: { leadId: string }[],
  lead: MarketingLead,
): boolean {
  return Boolean(lead.convertedCustomerId) || customers.some((c) => c.leadId === lead.id);
}

export function totalPipelineValue(leads: readonly MarketingLead[]): number {
  return leads
    .filter((l) => l.stage !== "won" && l.stage !== "lost")
    .reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
}