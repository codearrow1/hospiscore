/**
 * Home-page FAQ content — shared by the visible <Faq> component and the
 * FAQPage JSON-LD so the structured data always matches what users see.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: "What is HospiOS?",
    a: "HospiOS is an all-in-one cloud-based Hotel Property Management System (PMS) built for hotels, resorts, homestays, villas, hostels, boutique hotels, service apartments, holiday homes, and multi-property groups. It unifies reservations, front desk, housekeeping, restaurant POS, finance, HRMS, channel management, analytics, and AI automation in a single platform.",
  },
  {
    q: "Which OTAs does the channel manager sync with?",
    a: "Booking.com, Airbnb, Expedia, Agoda, VRBO, Google Hotels, MakeMyTrip, Goibibo, Yatra, Cleartrip, Hotelbeds, and Trip.com. Inventory, rates, and restrictions sync two-way in real time, with room and rate-plan mapping and a full sync log.",
  },
  {
    q: "Can it handle multiple properties?",
    a: "Yes. The Enterprise plan gives you a centralized dashboard with property switching, shared users, consolidated reporting, central CRM and central inventory — while keeping property-specific pricing and branding.",
  },
  {
    q: "We already use another PMS — how hard is migration?",
    a: "Most properties go live within a day for a pilot. Our onboarding team handles data import for guest profiles, reservations, and configuration, and supports you through your first full night audit.",
  },
  {
    q: "How is my data kept secure?",
    a: "Role-based access, two-factor authentication, activity logs, API-key and session management, password policies, automated backups, and disaster recovery — all on an enterprise-grade cloud architecture.",
  },
  {
    q: "Do I need to change my restaurant or accounting systems?",
    a: "No. HospiOS includes a complete restaurant POS with KDS and QR menus, and full finance and GST invoicing. It also connects to payment gateways, accounting software, calendars, door locks, and IoT devices via REST APIs and webhooks.",
  },
  {
    q: "How do I get a demo?",
    a: "Book a 30-minute walkthrough — we run your properties live on HospiOS and you can ask anything. There's a free online presence score you can try instantly, no sign-up needed.",
  },
];
