import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { listSaved, addSaved } from "@/lib/saved";
import { findProperty } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function savedPublic(s: Awaited<ReturnType<typeof listSaved>>[number]) {
  const last = s.history[s.history.length - 1];
  return {
    slug: s.slug,
    name: s.name,
    city: s.city,
    country: s.country,
    color: s.color,
    savedAt: s.savedAt,
    score: last.overall,
    grade: last.grade,
    history: s.history.map((h) => ({ at: h.at, overall: h.overall })),
  };
}

/**
 * GET /api/saved — the signed-in owner's saved properties (public shape).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const saved = await listSaved(user.id);
  return NextResponse.json({ saved: saved.map(savedPublic) });
}

/**
 * POST /api/saved { slug } — save a property for the signed-in owner.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const slug = (body.slug ?? "").toString().trim();
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const property = findProperty(slug);
  if (!property) return NextResponse.json({ error: "Unknown property" }, { status: 404 });

  const saved = await addSaved(user.id, property);
  const last = saved.history[saved.history.length - 1];
  return NextResponse.json({
    ok: true,
    saved: {
      slug: saved.slug,
      name: saved.name,
      city: saved.city,
      country: saved.country,
      color: saved.color,
      savedAt: saved.savedAt,
      score: last.overall,
      grade: last.grade,
      history: saved.history.map((h) => ({ at: h.at, overall: h.overall })),
    },
  });
}