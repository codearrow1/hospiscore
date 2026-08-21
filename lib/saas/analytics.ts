/**
 * SaaS Platform Analytics — boundary (Phase K)
 * Aggregates MRR/ARR/Churn/LTV/CAC/ARPU by plan/country/channel.
 * Reuses lib/marketing/metrics.ts pattern but over SaaS subscriptions.
 * Thin slice already in lib/saas/metrics.ts (saasMetrics). This file will hold drilldowns.
 */

export async function revenueByCountry(): Promise<never[]> { return []; }
export async function churnCohort(): Promise<never[]> { return []; }
