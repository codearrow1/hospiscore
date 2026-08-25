/**
 * Notification helper — push in-app notifications for SaaS events.
 * Notifications are passive; they don't block the calling mutation.
 */
import { prisma } from "@/lib/prisma";

export async function pushNotification(input: {
  userId: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 500),
        href: input.href || null,
      },
    });
  } catch {
    // Notification delivery is best-effort — never block the caller.
  }
}

/** Bulk-push to all users in an organization. */
export async function pushNotificationToOrg(input: {
  organizationId: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  excludeUserId?: string;
}) {
  try {
    const contacts = await prisma.orgContact.findMany({
      where: { organizationId: input.organizationId },
      select: { email: true },
    });
    // Notifications are keyed by userId (from session). We store by email as
    // userId fallback — the UI resolves the current user's email to filter.
    for (const c of contacts) {
      await prisma.notification.create({
        data: {
          userId: c.email, // resolved by the bell component's current user
          kind: input.kind,
          title: input.title.slice(0, 200),
          body: input.body.slice(0, 500),
          href: input.href || null,
        },
      });
    }
  } catch {
    // best-effort
  }
}
