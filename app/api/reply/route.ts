import { NextRequest, NextResponse } from "next/server";
import { replyDraft } from "@/lib/reply";
import { originAllowed, rateLimit, clientIp } from "@/lib/marketing/guard";
import type { PlatformKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reply
 * Body: { propertyName, review: { text, platform, rating, author? } }
 * Returns: { reply, source, status }
 */
export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: "Rejected" }, { status: 403 });
  }
  // LLM-backed endpoint: aggressive per-client throttling to guard cost.
  if (!rateLimit(`reply:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let body: {
    propertyName?: string;
    review?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const propertyName = (body.propertyName ?? "").toString().trim().slice(0, 200) || "our hotel";
  const raw = body.review;
  if (!raw || typeof raw.text !== "string" || !raw.text.trim()) {
    return NextResponse.json({ error: "review.text is required" }, { status: 400 });
  }
  const reviewText = raw.text.trim().slice(0, 5000);
  const rating = Number(raw.rating ?? 3);
  const platform = (raw.platform as PlatformKey) ?? "booking";
  const author = raw.author ? raw.author.toString().slice(0, 200) : undefined;

  const draft = await replyDraft({ text: reviewText, platform, rating, author }, propertyName);

  return NextResponse.json(draft);
}