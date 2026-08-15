import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { removeSaved } from "@/lib/saved";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/saved/[slug] — unsave a property for the signed-in owner.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const slug = decodeURIComponent((await params).slug);
  const removed = await removeSaved(user.id, slug);
  return NextResponse.json({ ok: removed });
}