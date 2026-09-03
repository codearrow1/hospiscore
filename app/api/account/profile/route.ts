import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { readData, writeData } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/profile — Get current user profile.
 * PATCH /api/account/profile — Update current user profile.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await readData();
  const userData = data.users.find((u) => u.id === user.id || u.email === user.email);

  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id: userData.id,
    name: userData.name,
    email: userData.email,
    createdAt: userData.createdAt,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const name = body.name.trim();
  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
  }

  await writeData((data) => {
    const userData = data.users.find((u) => u.id === user.id || u.email === user.email);
    if (userData) {
      userData.name = name;
    }
    return data;
  });

  return NextResponse.json({ ok: true, name });
}
