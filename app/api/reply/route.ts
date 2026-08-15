import { NextResponse } from "next/server";
import { replyDraft } from "@/lib/reply";
import type { PlatformKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reply
 * Body: { propertyName, review: { text, platform, rating, author? } }
 * Returns: { reply, source, status }
 */
export async function POST(request: Request) {
  let body: {
    propertyName?: string;
    review?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const propertyName = (body.propertyName ?? "").toString().trim() || "our hotel";
  const raw = body.review;
  if (!raw || typeof raw.text !== "string" || !raw.text.trim()) {
    return NextResponse.json({ error: "review.text is required" }, { status: 400 });
  }
  const rating = Number(raw.rating ?? 3);
  const platform = (raw.platform as PlatformKey) ?? "booking";
  const author = raw.author ? raw.author.toString() : undefined;

  const draft = await replyDraft({ text: raw.text, platform, rating, author }, propertyName);

  return NextResponse.json(draft);
}