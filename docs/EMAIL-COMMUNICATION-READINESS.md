# EMAIL / COMMUNICATION READINESS — HospiOS SaaS Management App

**Release:** `9eefac5` · Source: `lib/mailer.ts`, `lib/config.ts`. No fake "sent successfully" states —
delivery is only real once SMTP (or webhook) transport is provisioned on the host.

## Transport (in priority order — `lib/mailer.ts`)
1. **SMTP** — used when `SMTP_HOST` **and** `SMTP_USER` are set (`CONFIG.smtpEnabled`). nodemailer,
   `secure` when port 465; `from = SMTP_FROM` (default `noreply@thebuddharice.online`).
2. **Webhook** — if `ALERT_WEBHOOK_URL` set, POST JSON `{to, subject, html}` (Resend/Mailgun/relay).
3. **Console** — otherwise print to stdout (dev default; **not** production delivery).

## Message classes (where email is triggered)
| Class | Trigger | Transport notes |
|-------|---------|-----------------|
| Password reset | `/account` reset flow | Requires provisioned SMTP (Phase 14 of the brief). |
| Lead notification + auto-reply | marketing form/demo submission (`lib/marketing.test.ts` shows To: sales + To: lead) | Via `sendMail`. |
| Follow-up digest | `POST /api/marketing/cron/followups` / `GET ?send=1` | Emails digest to sales + per-owner. |
| Support/ticket notifications | Support workflows (Phase 29) | Via `sendMail`. |
| Alert digest | `npm run alerts` / weekly score alert | `ALERT_WEBHOOK_URL` or console. |
| Claim/verification notifications | Claim workflow | Via `sendMail` where implemented. |
| Invoice/payment notifications | SaaS billing/payment | Via `sendMail`. |

## Classification (per brief)
| Item | Status |
|------|--------|
| SMTP transport wiring | **READY in code / CONFIGURED BY ENV** (worked only when `SMTP_HOST`+`SMTP_USER`+`SMTP_PASS` set on host) |
| Email templates (password reset, lead, follow-up, support, invoice/payment) | **IMPLEMENTED / CONFIGURED BY ENV** (delivery = host SMTP) |
| WhatsApp | **NOT IMPLEMENTED** (out of scope) |
| SMS / OTP delivery | **NOT IMPLEMENTED / HOST-PROVISIONED** — OTP delivery provider is an open business decision (O-02) |
| System alerts | **CONFIGURED BY ENV** (`ALERT_WEBHOOK_URL`) |
| Reservation confirmations | **N/A** — operational PMS is out of scope |

## HOST ACTION to make email real
Set on hPanel: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (and optionally `ALERT_WEBHOOK_URL`).
Then verify delivery to a **controlled/internal test address only** (never real customers):
password reset, lead notification, follow-up digest, invoice/payment notification. Confirm each
arrives and that non-delivery surfaces a logged error rather than a fake success.
