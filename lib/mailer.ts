import { CONFIG } from "@/lib/config";

/**
 * Outbound e-mail transport (server-only).
 *
 * Three transports (tried in order):
 *  1. SMTP — when SMTP_HOST + SMTP_USER are set, sends via nodemailer.
 *  2. webhook — POST the message as JSON to `ALERT_WEBHOOK_URL` (Resend/Mailgun
 *     or any HTTP relay). The payload is `{ to, subject, html }`.
 *  3. console — default — prints the formatted message to stdout so you can run
 *     `npm run alerts` in dev without an SMTP provider.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

export type MailTransport = "smtp" | "webhook" | "console";

let _smtpTransport: ReturnType<typeof import("nodemailer").createTransport> | null = null;

function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;
  if (!CONFIG.smtpEnabled) return null;
  // Lazy-import nodemailer so it's only required when SMTP is actually configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require("nodemailer");
  _smtpTransport = nodemailer.createTransport({
    host: CONFIG.smtpHost,
    port: CONFIG.smtpPort,
    secure: CONFIG.smtpPort === 465,
    auth: CONFIG.smtpUser ? { user: CONFIG.smtpUser, pass: CONFIG.smtpPass } : undefined,
  });
  return _smtpTransport;
}

export async function sendMail(msg: MailMessage): Promise<MailTransport> {
  // 1. SMTP
  const smtp = getSmtpTransport();
  if (smtp) {
    await smtp.sendMail({ from: CONFIG.smtpFrom, to: msg.to, subject: msg.subject, html: msg.html });
    return "smtp";
  }

  // 2. Webhook
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

  // 3. Console fallback
  console.log("───────────────────────────────");
  console.log(`[alert-email] To: ${msg.to}`);
  console.log(`[alert-email] Subject: ${msg.subject}`);
  console.log("───────────────────────────────");
  console.log(msg.html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim());
  console.log("───────────────────────────────");
  return "console";
}
