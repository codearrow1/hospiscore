/**
 * SaaS Properties (PMS Tenants) — boundary (Phase C)
 * A Property is a PMS instance owned by an Organization (tenant).
 * Preserves marketing/property scoring (lib/data.ts) separate from SaaS tenant registry.
 * DB model: prisma Property (organizationId, name, city, country, status)
 */

import { prisma } from "@/lib/prisma";

export async function listPropertiesByOrg(organizationId: string) {
  return prisma.property.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
}

export function validatePropertyInput(input: { name?: string; country?: string; rooms?: unknown }): { ok: true } | { ok: false; error: string } {
  const n = input.name?.trim();
  if (!n || n.length < 2) return { ok: false, error: "property name must be at least 2 characters" };
  if (n.length > 200) return { ok: false, error: "property name too long" };
  if (input.country && !/^[A-Za-z]{2}$/.test(input.country.trim())) return { ok: false, error: "country must be ISO2" };
  if (input.rooms !== undefined && input.rooms !== null) {
    const r = Number(input.rooms);
    if (!Number.isFinite(r) || r < 0 || r > 10000) return { ok: false, error: "rooms must be 0-10000" };
  }
  return { ok: true };
}

export async function createProperty(input: { organizationId: string; name: string; city?: string; country?: string; rooms?: number }) {
  const v = validatePropertyInput(input);
  if (!v.ok) throw new Error(v.error);
  // ensure org exists
  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
  if (!org) throw new Error("Organization not found");
  return prisma.property.create({
    data: {
      organizationId: input.organizationId,
      name: input.name.trim(),
      city: input.city?.trim() || null,
      country: input.country?.toUpperCase() || null,
      rooms: input.rooms ?? null,
    },
  });
}

export async function deleteProperty(id: string) {
  await prisma.property.delete({ where: { id } });
}
