import { readData } from "@/lib/db";
import { buildAlertDigest } from "@/lib/alerts";
import { sendMail } from "@/lib/mailer";

/**
 * Weekly score-alert runner.
 *
 * Reads every account's saved properties, recomputes their current score from
 * stored signals, builds a per-owner digest and sends it. Schedule with your
 * OS task scheduler / cron: `npm run alerts`.
 *
 * Recompute uses the signals stored at save/refresh time, so it reports deltas
 * when those signals change (e.g. after a live re-scrape writes back).
 */
async function main(): Promise<void> {
  const data = await readData();
  let sent = 0;
  let totalProps = 0;

  for (const user of data.users) {
    const saved = data.saved[user.id] ?? [];
    if (saved.length === 0) continue;
    const digest = buildAlertDigest(saved);
    await sendMail({ to: user.email, subject: digest.subject, html: digest.html });
    sent += 1;
    totalProps += saved.length;
  }

  console.log(`Alerts sent to ${sent} account(s) covering ${totalProps} saved propert${totalProps === 1 ? "y" : "ies"}.`);
}

main().catch((err) => {
  console.error("Alert runner failed:", err);
  process.exit(1);
});