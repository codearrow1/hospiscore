import { NextResponse } from "next/server";
import { submitDemoRequest, validateDemoInput, type DemoRequestInput } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/demo { name, email, company?, propertyName?, propertyCount?, message? }
 * Persists a demo-booking request. Returns 200 with the record id, 400 on
 * validation failure.
 */
export async function POST(request: Request) {
  let body: Partial<DemoRequestInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const check = validateDemoInput(body);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const record = await submitDemoRequest(body);
  return NextResponse.json({ ok: true, id: record.id, createdAt: record.createdAt });
}