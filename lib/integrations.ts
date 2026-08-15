/**
 * Marketing integrations catalogue. Rendered as logo-badges on the home page
 * and as the full /integrations page.
 */

export interface IntegrationGroup {
  id: string;
  label: string;
  blurb: string;
  items: string[];
}

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    id: "otas",
    label: "OTAs & distribution",
    blurb: "Two-way inventory, rate, and restriction sync in real time.",
    items: [
      "Booking.com",
      "Airbnb",
      "Expedia",
      "Agoda",
      "Tripadvisor",
      "Google Hotels",
      "MakeMyTrip",
      "Goibibo",
      "Yatra",
      "Cleartrip",
      "Hotelbeds",
      "Trip.com",
      "VRBO",
      "Hostelworld",
    ],
  },
  {
    id: "payments",
    label: "Payments & gateways",
    blurb: "Take and settle payments securely, on every channel.",
    items: ["Razorpay", "Stripe", "PayPal", "PayU", "Cashfree"],
  },
  {
    id: "comms",
    label: "Communication",
    blurb: "Reach guests where they already are.",
    items: ["WhatsApp Business", "Twilio SMS", "SendGrid", "Mailgun", "Slack"],
  },
  {
    id: "calendar",
    label: "Calendars & office",
    blurb: "Keep everyone's schedule in sync.",
    items: ["Google Calendar", "Outlook Calendar", "Microsoft 365"],
  },
  {
    id: "hardware",
    label: "Hardware & IoT",
    blurb: "Connect the physical property.",
    items: ["Assa Abloy Locks", "Salto", "Biometric Devices", "Printer Servers"],
  },
  {
    id: "accounting",
    label: "Accounting & BI",
    blurb: "Export clean books and dashboards.",
    items: ["Tally", "QuickBooks", "Xero", "Power BI", "Google Sheets"],
  },
];

export const TOTAL_INTEGRATIONS = INTEGRATION_GROUPS.reduce(
  (sum, g) => sum + g.items.length,
  0,
);

/** Flat list used by the home-page integrations bar. */
export const INTEGRATION_LOGOS = INTEGRATION_GROUPS.flatMap((g) => g.items);
