import { NextRequest, NextResponse } from "next/server";
import { originAllowed, clientIp, rateLimit } from "@/lib/marketing/guard";
import { peekPasswordReset, consumePasswordReset } from "@/lib/accounts";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/password-reset?token=… — pre-validate a token (no consume). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ valid: false }, { status: 400 });
  const rec = await peekPasswordReset(token);
  return NextResponse.json({ valid: Boolean(rec), expiresAt: rec?.expiresAt ?? null });
}

/** POST /api/auth/password-reset { token, password } — consume + set new password. */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`pwconfirm:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || password.length < 8) {
    return NextResponse.json({ error: "Token and a password of at least 8 characters are required" }, { status: 400 });
  }
  const passwordHash = await hashPassword(password);
  try {
    await consumePasswordReset({ token, passwordHash });
    // Existing sessions stay valid; the next login uses the new password.
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Reset failed" }, { status: 400 });
  }
}
