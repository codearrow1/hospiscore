import { listLeads } from "./leads";
import { sendMail } from "@/lib/mailer";
import { CONFIG } from "@/lib/config";
import type { MarketingLead } from "./types";

export interface FollowUpDigest {
  overdue: MarketingLead[];
  dueSoon: MarketingLead[];
  generatedAt: string;
}

export async function getOverdueLeads(target?: string): Promise<MarketingLead[]> {
  const leads = await listLeads(target);
  const now = Date.now();
  return leads
    .filter((l) => l.stage !== "won" && l.stage !== "lost" && !!l.nextFollowUpAt)
    .filter((l) => Date.parse(l.nextFollowUpAt as string) < now)
    .sort((a, b) => Date.parse(a.nextFollowUpAt as string) - Date.parse(b.nextFollowUpAt as string));
}

export async function getFollowUpDigest(target?: string): Promise<FollowUpDigest> {
  const leads = await listLeads(target);
  const now = Date.now();
  const dayMs = 86_400_000;
  const overdue: MarketingLead[] = [];
  const dueSoon: MarketingLead[] = [];
  for (const l of leads) {
    if (l.stage === "won" || l.stage === "lost" || !l.nextFollowUpAt) continue;
    const t = Date.parse(l.nextFollowUpAt);
    if (t < now) overdue.push(l);
    else if (t <= now + dayMs) dueSoon.push(l);
  }
  overdue.sort((a, b) => Date.parse(a.nextFollowUpAt as string) - Date.parse(b.nextFollowUpAt as string));
  dueSoon.sort((a, b) => Date.parse(a.nextFollowUpAt as string) - Date.parse(b.nextFollowUpAt as string));
  return { overdue, dueSoon, generatedAt: new Date().toISOString() };
}

export function buildDigestHtml(digest: FollowUpDigest): string {
  const { overdue, dueSoon } = digest;
  if (overdue.length === 0 && dueSoon.length === 0) {
    return "<p>All follow-ups are on track — nothing overdue or due in the next 24h.</p>";
  }
  const row = (l: MarketingLead) =>
    `<tr><td style="padding:6px 8px;border:1px solid #e4e4e7">${l.name} &lt;${l.email}&gt;</td><td style="padding:6px 8px;border:1px solid #e4e4e7">${l.company || l.propertyName || "-"}</td><td style="padding:6px 8px;border:1px solid #e4e4e7">${l.stage}</td><td style="padding:6px 8px;border:1px solid #e4e4e7">${l.ownerEmail || "unassigned"}</td><td style="padding:6px 8px;border:1px solid #e4e4e7">${new Date(l.nextFollowUpAt as string).toLocaleString()}</td></tr>`;
  let html = `<p>Follow-up digest generated at ${new Date(digest.generatedAt).toLocaleString()}</p>`;
  if (overdue.length) {
    html += `<h3 style="color:#dc2626">Overdue (${overdue.length})</h3><table style="border-collapse:collapse;width:100%"><tbody>${overdue.map(row).join("")}</tbody></table>`;
  }
  if (dueSoon.length) {
    html += `<h3 style="color:#d97706">Due in 24h (${dueSoon.length})</h3><table style="border-collapse:collapse;width:100%"><tbody>${dueSoon.map(row).join("")}</tbody></table>`;
  }
  const site = process.env.SITE_URL || "https://thebuddharice.online";
  html += `<p><a href="${site}/marketing-admin/leads">Open Leads</a></p>`;
  return html;
}

export async function sendFollowUpDigest(target?: string, toOverride?: string): Promise<{ sent: number; overdue: number; dueSoon: number }> {
  const digest = await getFollowUpDigest(target);
  if (digest.overdue.length === 0 && digest.dueSoon.length === 0) return { sent: 0, overdue: 0, dueSoon: 0 };
  const to = toOverride || CONFIG.salesEmail;
  const html = buildDigestHtml(digest);
  const subject = `Follow-up digest: ${digest.overdue.length} overdue, ${digest.dueSoon.length} due soon`;
  await sendMail({ to, subject, html });
  const byOwner = new Map<string, MarketingLead[]>();
  for (const l of [...digest.overdue, ...digest.dueSoon]) {
    if (!l.ownerEmail) continue;
    const arr = byOwner.get(l.ownerEmail) ?? [];
    arr.push(l);
    byOwner.set(l.ownerEmail, arr);
  }
  for (const [owner, leads] of byOwner) {
    if (owner === to) continue;
    try {
      const sub = leads.filter((l) => digest.overdue.some((o) => o.id === l.id)).length;
      await sendMail({
        to: owner,
        subject: `You have ${leads.length} follow-ups (${sub} overdue)`,
        html:
          `<p>Hi ${owner},</p>` +
          buildDigestHtml({
            overdue: leads.filter((l) => digest.overdue.some((o) => o.id === l.id)),
            dueSoon: leads.filter((l) => digest.dueSoon.some((o) => o.id === l.id)),
            generatedAt: digest.generatedAt,
          }),
      });
    } catch {}
  }
  return { sent: 1 + byOwner.size, overdue: digest.overdue.length, dueSoon: digest.dueSoon.length };
}
