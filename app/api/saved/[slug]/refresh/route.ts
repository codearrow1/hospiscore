import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { refreshSaved } from "@/lib/saved";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/saved/[slug]/refresh — recompute the saved property's score and
 * append a history point (powers the owner's cross-session score history).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const slug = decodeURIComponent((await params).slug);
  const saved = await refreshSaved(user.id, slug);
  if (!saved) return NextResponse.json({ error: "Property not saved" }, { status: 404 });

  const last = saved.history[saved.history.length - 1];
  return NextResponse.json({
    ok: true,
    saved: {
      slug: saved.slug,
      name: saved.name,
      score: last.overall,
      grade: last.grade,
      historyPoints: saved.history.length,
    },
  });
}