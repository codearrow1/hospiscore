import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin } from "@/lib/leads";
import { hasSaasPerm } from "@/lib/saas/roles";
import { originAllowed } from "@/lib/marketing/guard";
import {
  getPricingDoc,
  resetPricingDoc,
  savePricingDoc,
} from "@/lib/pricing/db";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";
import { PLANS } from "@/lib/pricing/catalog";
import type { AuthUser } from "@/lib/auth";
import type { PricingProfile } from "@/lib/pricing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/admin/pricing
 *
 * Internal pricing management. Requires an authenticated admin e-mail
 * (ADMIN_EMAILS). GET returns the active pricing document plus the country/
 * plan catalogs for the editor. PUT { profiles, label } (or { action:
 * "reset" }) persists a new pricing version — previous prices are snapshotted
 * into history so existing subscriptions keep their price.
 */

async function getAdminUser(): Promise<{
  user?: AuthUser;
  error?: NextResponse;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (!isAdmin(user)) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const { error } = await getAdminUser();
  if (error) return error;

  const doc = await getPricingDoc();
  return NextResponse.json({
    doc,
    seedCountries: SEED_COUNTRIES,
    plans: PLANS,
  });
}

export async function PUT(request: Request) {
  const { user, error } = await getAdminUser();
  if (error) return error;

  // Writing global prices is a marketing-admin capability — content editors
  // and other read-scoped roles must not rewrite the storefront pricing doc.
  if (!hasSaasPerm(user!, "MARKETING_MANAGE")) {
    return NextResponse.json({ error: "Marketing manage permission required" }, { status: 403 });
  }
  if (!originAllowed(request as unknown as Parameters<typeof originAllowed>[0])) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  let body: { profiles?: Record<string, PricingProfile>; label?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.action === "reset") {
    const doc = await resetPricingDoc(user!.email);
    return NextResponse.json({ ok: true, doc });
  }

  if (!body.profiles || typeof body.profiles !== "object") {
    return NextResponse.json({ error: "profiles are required" }, { status: 400 });
  }

  const label = (body.label ?? "").toString().trim() || "Pricing update";

  try {
    const doc = await savePricingDoc({
      profiles: body.profiles,
      label,
      byEmail: user!.email,
    });
    return NextResponse.json({ ok: true, doc });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save pricing" },
      { status: 422 },
    );
  }
}