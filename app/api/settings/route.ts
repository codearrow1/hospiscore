/**
 * Settings API — Phase B
 *
 * Centralized API for settings CRUD with:
 * - Role-based access control
 * - Audit logging
 * - Validation
 * - Batch operations
 */
import { NextResponse, NextRequest } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import {
  resolveSetting,
  resolveSettings,
  updateSetting,
  updateSettings,
  getSettingDefinition,
  getSettingDefinitions,
  type SettingDefinition,
} from "@/lib/settings/resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings — List all settings or filter by category.
 * GET /api/settings?key=xxx — Get a single setting.
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const category = searchParams.get("category") as SettingDefinition["category"] | null;

  // Single setting
  if (key) {
    const def = getSettingDefinition(key);
    if (!def) return NextResponse.json({ error: `Unknown setting: ${key}` }, { status: 404 });

    if (!hasPermissionForCategory(guard.user, def.category)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const value = await resolveSetting(key);
    return NextResponse.json({ key, value, definition: def });
  }

  // All settings (filtered by permission)
  let definitions = getSettingDefinitions();
  if (category) {
    definitions = definitions.filter(d => d.category === category);
  }

  // Filter by user permissions
  const permitted = definitions.filter(d => hasPermissionForCategory(guard.user, d.category));
  const keys = permitted.map(d => d.key);
  const values = await resolveSettings(keys);

  return NextResponse.json({
    settings: permitted.map(d => ({
      ...d,
      value: values[d.key],
    })),
  });
}

/**
 * PUT /api/settings — Update a setting.
 * PUT /api/settings — Update multiple settings.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;

  let body: { key?: string; value?: unknown; updates?: Array<{ key: string; value: unknown }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Batch update
  if (body.updates && Array.isArray(body.updates)) {
    for (const { key } of body.updates) {
      const def = getSettingDefinition(key);
      if (!def) return NextResponse.json({ error: `Unknown setting: ${key}` }, { status: 404 });
      if (!hasPermissionForCategory(guard.user, def.category)) {
        return NextResponse.json({ error: `Forbidden: ${key}` }, { status: 403 });
      }
    }

    const before = await resolveSettings(body.updates.map(u => u.key));
    await updateSettings(body.updates, guard.user.email);
    const after = await resolveSettings(body.updates.map(u => u.key));

    await writeSaasAudit({
      byEmail: guard.user.email,
      action: "settings.batch_updated",
      entity: "system_setting",
      entityId: body.updates.map(u => u.key).join(","),
      detail: `Updated ${body.updates.length} settings`,
      before,
      after,
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, updated: body.updates.length });
  }

  // Single update
  if (!body.key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const def = getSettingDefinition(body.key);
  if (!def) return NextResponse.json({ error: `Unknown setting: ${body.key}` }, { status: 404 });

  if (!hasPermissionForCategory(guard.user, def.category)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const before = await resolveSetting(body.key);
  await updateSetting(body.key, body.value, guard.user.email);
  const after = await resolveSetting(body.key);

  await writeSaasAudit({
    byEmail: guard.user.email,
    action: "settings.updated",
    entity: "system_setting",
    entityId: body.key,
    detail: `${body.key} changed`,
    before: { [body.key]: before },
    after: { [body.key]: after },
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true, key: body.key, value: after });
}

/**
 * Check if a user has permission to access settings in a category.
 */
function hasPermissionForCategory(
  user: { email: string; role?: string | null },
  category: SettingDefinition["category"],
): boolean {
  // Normalize role: null → undefined for compatibility with hasSaasPerm
  const normalizedUser = { email: user.email, role: user.role ?? undefined };
  // Super admin and platform admin can access everything
  if (hasSaasPerm(normalizedUser, "SYSTEM_SETTINGS_MANAGE")) return true;

  switch (category) {
    case "platform":
      return hasSaasPerm(normalizedUser, "SYSTEM_SETTINGS_MANAGE");
    case "security":
      return hasSaasPerm(normalizedUser, "SYSTEM_SETTINGS_MANAGE");
    case "email":
      return hasSaasPerm(normalizedUser, "SYSTEM_SETTINGS_MANAGE");
    case "billing":
      return hasSaasPerm(normalizedUser, "BILLING_MANAGE");
    case "affiliate":
      return hasSaasPerm(normalizedUser, "AFFILIATE_MANAGE");
    case "integration":
      return hasSaasPerm(normalizedUser, "SYSTEM_SETTINGS_MANAGE");
    case "analytics":
      return hasSaasPerm(normalizedUser, "SYSTEM_SETTINGS_MANAGE");
    default:
      return false;
  }
}
