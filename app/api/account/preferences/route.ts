import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { getUserPreferences, updateUserPreferences } from "@/lib/userPreferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prefs = await getUserPreferences(user.email);
  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { timezone?: string; dateFormat?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.timezone !== undefined || body.dateFormat !== undefined) {
    try {
      const prefs = await updateUserPreferences(user.email, body);
      return NextResponse.json(prefs);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "No fields to update" }, { status: 400 });
}
