import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { getUserPreferences } = await import("@/lib/userPreferences");
    const prefs = await getUserPreferences(user.email);
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json({ email: user.email, timezone: "UTC", dateFormat: "YYYY-MM-DD" });
  }
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
      const { updateUserPreferences } = await import("@/lib/userPreferences");
      const prefs = await updateUserPreferences(user.email, body);
      return NextResponse.json(prefs);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "No fields to update" }, { status: 400 });
}
