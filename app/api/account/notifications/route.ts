import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { readData, writeData } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NotificationPreference {
  kind: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

interface DataWithNotifications {
  notificationPreferences?: Record<string, NotificationPreference[]>;
}

/**
 * GET /api/account/notifications — Get notification preferences.
 * PATCH /api/account/notifications — Update notification preferences.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await readData();
  const extra = data as unknown as DataWithNotifications;
  const prefs = extra.notificationPreferences?.[user.id] || [];

  return NextResponse.json({ preferences: prefs });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { preferences?: NotificationPreference[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.preferences || !Array.isArray(body.preferences)) {
    return NextResponse.json({ error: "preferences array is required" }, { status: 400 });
  }

  // Validate preferences
  const validKinds = [
    "ticket.created", "ticket.replied", "subscription.renewed",
    "dunning.alert", "invoice.issued", "payout.approved",
    "commission.earned", "fraud.flagged", "campaign.joined", "terms.updated",
  ];

  for (const pref of body.preferences) {
    if (!validKinds.includes(pref.kind)) {
      return NextResponse.json({ error: `Invalid notification kind: ${pref.kind}` }, { status: 400 });
    }
    if (typeof pref.email !== "boolean" || typeof pref.push !== "boolean" || typeof pref.inApp !== "boolean") {
      return NextResponse.json({ error: `Invalid channels for ${pref.kind}` }, { status: 400 });
    }
  }

  // Save preferences
  await writeData((data) => {
    const extra = data as unknown as DataWithNotifications;
    if (!extra.notificationPreferences) {
      extra.notificationPreferences = {};
    }
    extra.notificationPreferences[user.id] = body.preferences!;
    return data;
  });

  return NextResponse.json({ ok: true });
}
