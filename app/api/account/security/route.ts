import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { readData, writeData } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/account/security — Update password.
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: "Current and new passwords are required" }, { status: 400 });
  }

  if (body.newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const data = await readData();
  const userData = data.users.find((u) => u.id === user.id || u.email === user.email);

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify current password
  const valid = await verifyPassword(body.currentPassword, userData.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  // Hash new password
  const newHash = await hashPassword(body.newPassword);

  // Update password
  await writeData((data) => {
    const userData = data.users.find((u) => u.id === user.id || u.email === user.email);
    if (userData) {
      userData.passwordHash = newHash;
    }
    return data;
  });

  return NextResponse.json({ ok: true });
}
