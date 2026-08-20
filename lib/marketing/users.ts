/**
 * Marketing team directory (settings) — list users and assign roles.
 * Role assignment itself is gated to settings.manage.
 */

import { readData, writeData } from "@/lib/db";
import { isMarketingRole, MARKETING_ROLES } from "./roles";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string;
}

export async function listUsers(target?: string): Promise<TeamMember[]> {
  const data = await readData(target);
  return data.users
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role ?? null, createdAt: u.createdAt }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function setUserRole(
  userId: string,
  role: string | null,
  target?: string,
): Promise<TeamMember | null> {
  if (role !== null && !isMarketingRole(role)) throw new Error("Invalid role");
  let out: TeamMember | null = null;
  await writeData(
    (d) => {
      const users = d.users.map((u) => (u.id === userId ? { ...u, ...(role ? { role } : { role: undefined }) } : u));
      if (users.some((u) => u.id === userId)) d.users = users;
      const found = d.users.find((u) => u.id === userId);
      out = found ? { id: found.id, name: found.name, email: found.email, role: found.role ?? null, createdAt: found.createdAt } : null;
      return d;
    },
    target,
  );
  return out;
}

export { MARKETING_ROLES };