/**
 * SaaS Sales Partners / Resellers — boundary (Phase H)
 * Separate from affiliates: partners sell/implement PMS (agencies, resellers).
 * Tiers: Registered|Silver|Gold|Platinum. Stub.
 */
export type PartnerTier = "registered" | "silver" | "gold" | "platinum";
export async function listPartners(): Promise<never[]> { return []; }
