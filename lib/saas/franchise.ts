/**
 * SaaS Franchise / Business Partners — boundary (Phase I)
 * Territory management (Country/Regional/City, Exclusive/Non-exclusive, Available→Expired).
 * Revenue share: fixed/%/tiered. Prevents conflicting exclusive territories.
 * Stub — Phase I will implement territory constraints + performance scoring.
 */
export type TerritoryStatus = "available" | "reserved" | "assigned" | "active" | "suspended" | "expired";
export async function listTerritories(): Promise<never[]> { return []; }
