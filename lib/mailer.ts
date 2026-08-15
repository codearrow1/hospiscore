import { CONFIG } from "@/lib/config";

/**
 * Outbound e-mail transport for owner alerts (server-only, dependency-free).
 *
 * Two transports:
 *  - webhook: POST the message as JSON to `ALERT_WEBHOOK_URL` (Resend/Mailgun
 *    or any HTTP relay). The payload is `{ to, subject, html }`.
 *  - console: default — prints the formatted message to stdout so you can run
 *    `npm run alerts` in dev without an SMTP provider.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

export type MailTransport = "webhook" | "console";

export async function sendMail(msg: MailMessage): Promise<MailTransport> {
  const webhook = CONFIG.alertWebhookUrl;
  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    if (!res.ok) throw new Error(`Alert webhook failed (${res.status})`);
    return "webhook";
  }

  console.log("───────────────────────────────");
  console.log(`[alert-email] To: ${msg.to}`);
  console.log(`[alert-email] Subject: ${msg.subject}`);
  console.log("───────────────────────────────");
  console.log(msg.html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim());
  console.log("───────────────────────────────");
  return "console";
}