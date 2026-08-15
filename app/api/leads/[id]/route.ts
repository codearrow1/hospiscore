import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin, setLeadStatus } from "@/lib/leads";
import { isLeadStatus } from "@/lib/accountTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/leads/[id] { status }
 *
 * Updates the sales status of a lead (new | contacted | won | closed).
 * Requires an authenticated admin e-mail (see ADMIN_EMAILS). Returns the
 * updated row, 400 on an invalid status, 404 for an unknown lead.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isLeadStatus(body.status)) {
    return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
  }

  const id = decodeURIComponent((await params).id);
  const row = await setLeadStatus(id, body.status);
  if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ ok: true, lead: row });
}
