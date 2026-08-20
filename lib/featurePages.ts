/**
 * Extended marketing content for flagship /platform/[slug] feature pages.
 * Modules without an entry render a generic template from lib/modules.ts.
 */

export interface FeaturePageContent {
  /** Marketing headline shown in the page hero. */
  headline: string;
  /** Lead paragraph. */
  intro: string;
  /** 3 short value propositions rendered as cards. */
  highlights: { title: string; body: string }[];
  /** Module-specific FAQs. */
  faqs: { q: string; a: string }[];
}

/** Slug → module id aliases so marketing URLs stay clean and Roomnexa-like. */
export const MODULE_ALIASES: Record<string, string> = {
  pms: "frontdesk",
  "channel-manager": "channel",
  "booking-engine": "bookingengine",
  "dynamic-pricing": "revenue",
  "revenue-manager": "revenue",
  "housekeeping-manager": "housekeeping",
  "ai-assistant": "ai",
  payments: "finance",
  pos: "pos",
  "restaurant-pos": "pos",
};

export const FEATURE_CONTENT: Record<string, FeaturePageContent> = {
  frontdesk: {
    headline: "Run every room, guest, and task from one command center",
    intro:
      "Your property command center — rooms, housekeeping, front desk, and guest folios stay in sync without switching tools. Check guests in with one click, move and upgrade rooms live, and never re-key a detail.",
    highlights: [
      { title: "Live room board", body: "Color-coded room status with occupancy at a glance, updated the moment anything changes." },
      { title: "Express check-in", body: "Digital registration, walk-ins, group and corporate bookings in seconds, not screens." },
      { title: "Guest folios in one place", body: "Charges, payments, and balances follow the guest across the whole stay." },
    ],
    faqs: [
      {
        q: "Does HospiOS handle group and corporate bookings?",
        a: "Yes — group bookings, corporate accounts, walk-ins, VIP management, room moves and upgrades, waitlists, no-shows, and blacklist management are all part of the front desk module.",
      },
      {
        q: "Can the front desk talk to housekeeping in real time?",
        a: "Instantly. When a room is checked out it becomes a housekeeping task; when housekeeping marks it ready, it returns to availability — no phone calls or separate apps.",
      },
    ],
  },
  channel: {
    headline: "Connect 14+ booking channels without the overhead",
    intro:
      "Inventory, rates, and restrictions sync two-way across every major OTA in real time — from Booking.com and Airbnb to Trip.com and Hotelbeds. One dashboard, zero channel-hopping, zero overbookings.",
    highlights: [
      { title: "Real-time two-way sync", body: "Availability, rates, and restrictions flow to every channel the moment they change." },
      { title: "Room & rate-plan mapping", body: "Map room types and rate plans once; every channel stays aligned forever." },
      { title: "Distribution dashboard", body: "See channel mix, pace, and OTA analytics to make smarter distribution calls." },
    ],
    faqs: [
      {
        q: "Which channels can I connect?",
        a: "Booking.com, Airbnb, Expedia, Agoda, VRBO, Google Hotels, MakeMyTrip, Goibibo, Yatra, Cleartrip, Hotelbeds, Trip.com, Hostelworld and more — 14+ demand channels supported.",
      },
      {
        q: "Will I ever overbook?",
        a: "No. Two-way sync means every booking closes inventory everywhere instantly, and stop-sell and min-stay rules apply across all channels at once.",
      },
    ],
  },
  bookingengine: {
    headline: "Turn lookers into guests on every device",
    intro:
      "A fast, branded booking flow on web and mobile — designed to convert direct traffic without paying OTA commission. Real-time availability tied directly to your PMS, with upsells and best-price guarantees.",
    highlights: [
      { title: "Mobile-first booking", body: "Instant confirmation on any device, optimized to convert your website traffic." },
      { title: "Branded upsells", body: "Room upgrades, meals, and transfers offered at checkout with a best-price guarantee." },
      { title: "Real-time availability", body: "Availability and rates live from your PMS — no double bookings, ever." },
    ],
    faqs: [
      {
        q: "Does the booking engine connect to my PMS?",
        a: "Yes — it's the same inventory your front desk uses, so availability and rates are always in sync and bookings appear instantly in your PMS.",
      },
      {
        q: "Can I promote packages and promo codes?",
        a: "Absolutely. Packages, promo codes, gift vouchers, and multi-language support are built in, alongside gallery, reviews, and SEO-ready pages.",
      },
    ],
  },
  housekeeping: {
    headline: "Housekeeping that stays in sync with the front desk",
    intro:
      "Cleaning schedules, inspections, and readiness — assigned and approved end to end. Rooms flow from checkout to clean to ready automatically, so your team always knows what to do next.",
    highlights: [
      { title: "Auto-generated tasks", body: "Checkouts become cleaning tasks and ready rooms return to availability automatically." },
      { title: "Checklists & inspections", body: "Standard and deep-cleaning checklists with supervisor approval before a room goes live." },
      { title: "Linen & lost & found", body: "Linen management, amenities replenishment, and lost & found tracking built in." },
    ],
    faqs: [
      {
        q: "How does housekeeping know a room is available?",
        a: "The moment a guest checks out, the room appears as a housekeeping task. Your supervisor approves it once clean, and it's instantly bookable again.",
      },
      {
        q: "Can I see housekeeping status across the property?",
        a: "Yes — a live readiness board shows every room's status by floor and building, plus staff assignments for the shift.",
      },
    ],
  },
  pos: {
    headline: "Restaurant, kitchen, and room service in one POS",
    intro:
      "Table service, a kitchen display system, QR menus, and room service — from KOT to settlement. Bills, split bills, discounts, and food-cost analysis keep your F&B profitable.",
    highlights: [
      { title: "POS + KDS", body: "Orders flow to the kitchen display the moment they're taken — no shouting, no lost tickets." },
      { title: "QR menus & room service", body: "Guests scan, order, and charge to their room folio from anywhere in the property." },
      { title: "Food cost control", body: "Recipe consumption, modifiers, and inventory deduction track your true food cost." },
    ],
    faqs: [
      {
        q: "Can restaurant bills be charged to a guest room?",
        a: "Yes — one click posts the bill to the guest folio, and split bills and multiple payment methods are fully supported.",
      },
      {
        q: "Does the POS deduct inventory automatically?",
        a: "Yes. KOT items consume recipe ingredients from stock in real time, so your inventory stays accurate without counting.",
      },
    ],
  },
  revenue: {
    headline: "AI pricing that fills rooms and lifts revenue",
    intro:
      "Dynamic, seasonal, and length-of-stay pricing with AI recommendations. Simulate strategies before you publish, forecast demand, and watch competitor rates — all from one dashboard.",
    highlights: [
      { title: "AI rate recommendations", body: "Occupancy-aware pricing suggestions you can apply to PMS and OTAs in one click." },
      { title: "Simulate before you publish", body: "Test weekend markups and last-minute discounts against projected ADR and occupancy." },
      { title: "Demand forecasting", body: "Seasonal pickup and pace-of-booking analysis to plan pricing and staffing." },
    ],
    faqs: [
      {
        q: "How does dynamic pricing work?",
        a: "HospiOS blends occupancy, demand forecasts, and competitor rates to recommend daily rates per room type — weekend, seasonal, festival, and length-of-stay rules included.",
      },
      {
        q: "Will AI pricing affect my OTA rates too?",
        a: "Only if you choose. Apply recommendations to your PMS and then to your channel manager, or keep channels on their own rate plans.",
      },
    ],
  },
  finance: {
    headline: "Payments, folios, and night audit without the spreadsheets",
    intro:
      "Guest folios, GST invoices, deposits and refunds, cash management, and a one-click night audit. Every rupee reconciles, and the reports your accountant loves are one export away.",
    highlights: [
      { title: "Folios & GST invoices", body: "Every charge and payment follows the guest, with compliant invoicing and credit notes." },
      { title: "Night audit in minutes", body: "Shift closing, day roll, and audit reports run clean every single night." },
      { title: "Payment reconciliation", body: "Razorpay, Stripe, and cash all tie out at the end of each shift." },
    ],
    faqs: [
      {
        q: "Does HospiOS handle GST invoices?",
        a: "Yes — GST invoices, credit notes, debit notes, deposits, refunds, and tax reports are built in and export-ready.",
      },
      {
        q: "Which payment gateways can I use?",
        a: "Razorpay, Stripe, PayPal, PayU, and Cashfree, plus cash and card — all reconciled automatically.",
      },
    ],
  },
  ai: {
    headline: "Your AI co-pilot for the whole property",
    intro:
      "An AI concierge and chatbot for guests, sentiment analysis on every review, automated reply drafts, AI check-in, and revenue and inventory forecasting — AI runs the back office so your team stays guest-first.",
    highlights: [
      { title: "AI concierge & chatbot", body: "Guests get instant answers and requests fulfilled around the clock." },
      { title: "Review intelligence", body: "Sentiment analysis and one-click reply drafts turn feedback into action." },
      { title: "Predictive operations", body: "Pricing, housekeeping, and inventory forecasts guided by live demand." },
    ],
    faqs: [
      {
        q: "What does the AI assistant actually do?",
        a: "It answers guests via chat, drafts review replies, recommends prices, predicts occupancy and stock, and automates check-in — with humans always in control.",
      },
      {
        q: "Does it use my own data?",
        a: "Yes, and it's yours. AI recommendations are built on your property's live data, secured behind role-based access and activity logging.",
      },
    ],
  },
  dashboard: {
    headline: "Your entire property, on one live command center",
    intro:
      "Real-time KPIs, arrivals, departures, housekeeping status, and OTA sync alerts on a single screen built for the general manager and the front office — role-based, widget-driven, and always current.",
    highlights: [
      { title: "Live KPIs & occupancy", body: "Revenue, occupancy, ADR, and RevPAR update the moment anything changes." },
      { title: "Shift awareness", body: "Arrivals, departures, and pending payments for today's shift at a glance." },
      { title: "Role-based views", body: "Every role sees the widgets they need — and nothing they shouldn't." },
    ],
    faqs: [
      {
        q: "Can I customize the dashboard?",
        a: "Yes — add, remove, and rearrange widgets per role, and save quick actions for the tasks you do most.",
      },
      {
        q: "Is the dashboard real-time?",
        a: "Yes. Room status, housekeeping, payments, and OTA sync alerts update live from the same data the rest of the platform uses.",
      },
    ],
  },
  reservations: {
    headline: "Every reservation, from every channel, in one booking wizard",
    intro:
      "Direct, OTA, and manual reservations in a booking wizard with a live availability calendar, rate plans, promotions, and auto-confirmations — with modifications and cancellations handled in one place.",
    highlights: [
      { title: "One-click booking wizard", body: "Walk-ins, phone bookings, and web reservations in seconds, not screens." },
      { title: "Rate plans & promotions", body: "Dynamic pricing, coupons, and offers applied without re-keying." },
      { title: "Change & cancel with confidence", body: "Modifications, cancellations, holds, and waitlists with full history." },
    ],
    faqs: [
      {
        q: "Can I take group and corporate reservations?",
        a: "Yes — group bookings, corporate accounts, walk-ins, waitlists, and no-shows are all handled from the same screen.",
      },
      {
        q: "Do OTA bookings appear automatically?",
        a: "Yes — channel manager reservations import and confirm in real time, closing inventory across every channel.",
      },
    ],
  },
  rooms: {
    headline: "A room master your whole team actually reads",
    intro:
      "Categories, floors, buildings, amenities, photos, and statuses with smart color coding — so front desk, housekeeping, and maintenance always agree on what a room is and whether it's available.",
    highlights: [
      { title: "Room master with structure", body: "Categories, floors, buildings, and amenities configured in one place." },
      { title: "Live room status", body: "Clean, dirty, occupied, OOO, and out-of-service with clear color coding." },
      { title: "Inspections & blocking", body: "Room inspections and blocking for maintenance without double bookings." },
    ],
    faqs: [
      {
        q: "What is room color coding?",
        a: "Each status — clean, dirty, occupied, OOO, and out-of-service — has its own color, so one glance at the board tells you what's sellable.",
      },
      {
        q: "Can I add amenities and photos?",
        a: "Yes, per room and per category — and they're shown automatically in your website booking engine.",
      },
    ],
  },
  crm: {
    headline: "Know every guest before they check in",
    intro:
      "A full guest profile with stays, preferences, documents, loyalty, and a single timeline — plus segmentation, VIP tags, and campaigns that turn repeat guests into regulars.",
    highlights: [
      { title: "Complete guest timeline", body: "Stays, preferences, documents, and messages in one scrollable view." },
      { title: "Loyalty & membership", body: "Points, wallets, and member tiers built in, not bolted on." },
      { title: "Segmentation & campaigns", body: "VIP tags, segments, and reminders for targeted outreach." },
    ],
    faqs: [
      {
        q: "Is guest data portable?",
        a: "Yes — you can export it any time. It's your data, secured behind role-based access and activity logging.",
      },
      {
        q: "Can I automate guest communication?",
        a: "Yes — campaigns and reminders flow through the Communication Center via email, WhatsApp, and SMS.",
      },
    ],
  },
  selfservice: {
    headline: "Give guests a five-star stay from their own phone",
    intro:
      "Guests book, check in, order room service, request housekeeping, and settle invoices from a branded self-service portal — fewer calls to the front desk, faster service for everyone.",
    highlights: [
      { title: "Digital check-in & check-out", body: "Guests skip the queue with mobile check-in and check-out." },
      { title: "Requests & room service", body: "Housekeeping, laundry, and F&B requests land straight in the right team's queue." },
      { title: "Invoices & loyalty", body: "Guests view and settle invoices and track loyalty points in one place." },
    ],
    faqs: [
      {
        q: "Does the portal connect to my PMS?",
        a: "Yes — it reads the same data your front desk uses, so requests and charges appear for staff instantly.",
      },
      {
        q: "Can guests pay in the portal?",
        a: "Yes — invoices and payments are settled securely through your connected payment gateways.",
      },
    ],
  },
  comms: {
    headline: "Automated guest communication across every channel",
    intro:
      "Email, WhatsApp, and SMS automations for confirmations, reminders, review requests, and broadcasts — plus internal team messaging, so guests are informed and staff stay aligned.",
    highlights: [
      { title: "Multi-channel automations", body: "Email, WhatsApp, and SMS triggered by real events in the PMS." },
      { title: "Right-time touchpoints", body: "Confirmations, check-in, check-out, and review requests on autopilot." },
      { title: "Team inbox", body: "Internal messaging keeps departments coordinated without leaving the platform." },
    ],
    faqs: [
      {
        q: "Can I send campaigns?",
        a: "Yes — broadcasts and segmented campaigns across email, WhatsApp, and SMS with ready-made templates.",
      },
      {
        q: "Does it support WhatsApp Business?",
        a: "Yes, alongside email and SMS — with templates for confirmations, reminders, and review requests.",
      },
    ],
  },
  laundry: {
    headline: "Laundry that never goes missing",
    intro:
      "Guest laundry and hotel linen with pickup, tracking, billing, and damage reporting — every item accounted for, from collection to return.",
    highlights: [
      { title: "Guest & hotel linen", body: "Track guest laundry and house linen through one simple flow." },
      { title: "Pickup to delivery", body: "Status tracking at every stage, with damage reporting built in." },
      { title: "Billing & inventory", body: "Charges post to folios automatically and linen counts stay accurate." },
    ],
    faqs: [
      {
        q: "Can guests request laundry from the portal?",
        a: "Yes — requests flow in from the self-service portal and appear as tasks for your team.",
      },
      {
        q: "How is billing handled?",
        a: "Laundry charges post to the guest folio automatically, so nothing is missed at check-out.",
      },
    ],
  },
  maintenance: {
    headline: "From a leaking tap to a full renovation — tracked",
    intro:
      "Preventive and corrective work orders with technician assignment, vendor and AMC tracking, asset history, and cost reporting — so nothing slips and every asset has a record.",
    highlights: [
      { title: "Preventive & corrective", body: "Scheduled maintenance and one-off repairs on a single board." },
      { title: "Technicians & vendors", body: "Assign work, track vendors, AMCs, and assets from one place." },
      { title: "Cost tracking", body: "Understand maintenance spend per asset, category, and property." },
    ],
    faqs: [
      {
        q: "Can guests report issues?",
        a: "Yes — reports from the self-service portal become work orders instantly.",
      },
      {
        q: "Do I get reminders for AMCs?",
        a: "Yes — preventive schedules and AMC renewals surface as alerts so contracts never lapse silently.",
      },
    ],
  },
  inventory: {
    headline: "Stock that counts itself",
    intro:
      "Inventory master, purchase orders, goods receipt, stock transfers, and recipe-driven consumption — from procurement to valuation, with low-stock alerts before you run out.",
    highlights: [
      { title: "Real-time stock", body: "Accurate counts and low-stock alerts across every store." },
      { title: "Procurement flow", body: "Purchase orders and vendor management from request to receipt." },
      { title: "Recipe consumption", body: "POS orders deduct ingredients automatically and valuation stays correct." },
    ],
    faqs: [
      {
        q: "Does the POS deduct stock automatically?",
        a: "Yes — KOT items consume recipe ingredients in real time, so your inventory stays accurate without counting.",
      },
      {
        q: "Can I manage multiple stores?",
        a: "Yes — stock transfers and per-store valuation are supported for multi-store properties.",
      },
    ],
  },
  hrms: {
    headline: "Your whole team, rostered, paid, and managed in one place",
    intro:
      "Departments, shifts, rosters, attendance, leave, payroll, and performance — with role-based permissions that keep staff data exactly as secure as guest data.",
    highlights: [
      { title: "Rosters & attendance", body: "Shifts, leave, and attendance on a single calendar per department." },
      { title: "Payroll built in", body: "Salary structures, incentives, and payslips without spreadsheets." },
      { title: "Performance & roles", body: "Appraisals, KPIs, and granular role-based permissions." },
    ],
    faqs: [
      {
        q: "Does it calculate payroll?",
        a: "Yes — salary structure, attendance, incentives, and payroll all run inside HRMS.",
      },
      {
        q: "Can each property have its own staff rules?",
        a: "Yes — per-property and per-department settings, with central visibility for groups.",
      },
    ],
  },
  bi: {
    headline: "The numbers behind every decision, live",
    intro:
      "Revenue, occupancy, ADR, RevPAR, GOPPAR, channel, guest, and marketing analytics as live dashboards — plus forecasting and executive views for leadership.",
    highlights: [
      { title: "Live KPIs", body: "Occupancy, ADR, RevPAR, and GOPPAR in real time." },
      { title: "Deep analytics", body: "Channel, guest, and marketing performance across properties." },
      { title: "Forecasting", body: "Demand and revenue forecasts that inform pricing and staffing." },
    ],
    faqs: [
      {
        q: "Can I export reports?",
        a: "Yes — CSV and Excel exports, plus scheduled reports delivered to your inbox.",
      },
      {
        q: "Is it consolidated for groups?",
        a: "Yes — executive dashboards roll up every property in the portfolio.",
      },
    ],
  },
  marketing: {
    headline: "Fill rooms with campaigns, loyalty, and reviews",
    intro:
      "Coupons, gift cards, referral programs, membership tiers, and multi-channel campaigns — plus review management that turns feedback into repeat bookings.",
    highlights: [
      { title: "Offers & vouchers", body: "Coupons, gift cards, and promotions managed in one place." },
      { title: "Loyalty program", body: "Membership plans and points that keep guests coming back." },
      { title: "Campaigns & reviews", body: "Email, WhatsApp, and SMS campaigns with review management built in." },
    ],
    faqs: [
      {
        q: "Can I run a referral program?",
        a: "Yes — referral links and rewards are built in and easy to share.",
      },
      {
        q: "Do offers work on the booking engine?",
        a: "Yes — promo codes and packages apply at checkout on your website automatically.",
      },
    ],
  },
  multiproperty: {
    headline: "Run a whole portfolio from one dashboard",
    intro:
      "A central dashboard with property switching, shared users, consolidated reporting, central CRM and inventory — while every property keeps its own pricing and brand.",
    highlights: [
      { title: "Central command center", body: "Switch between properties without logging in and out." },
      { title: "Consolidated reporting", body: "Portfolio-wide revenue, occupancy, and performance views." },
      { title: "Shared everything", body: "Central CRM, central inventory, and shared user roles." },
    ],
    faqs: [
      {
        q: "Can each property set its own rates?",
        a: "Yes — property-specific pricing, branding, and offers stay fully intact.",
      },
      {
        q: "How are users shared?",
        a: "Roles are shared centrally but scoped per property, so access stays exactly where you want it.",
      },
    ],
  },
  security: {
    headline: "Enterprise-grade security without the setup cost",
    intro:
      "Role-based access control, two-factor authentication, activity logs, API keys, session and device management, password policies, backups, and disaster recovery.",
    highlights: [
      { title: "Role-based access", body: "Fine-grained permissions per role, module and property." },
      { title: "2FA & activity logs", body: "Two-factor authentication and reviewable activity logs." },
      { title: "Backups & recovery", body: "Automated backups and disaster recovery built in from day one." },
    ],
    faqs: [
      {
        q: "Can I set different permissions per property?",
        a: "Yes — role scope is configurable per property and per module for multi-property groups.",
      },
      {
        q: "What compliance is covered?",
        a: "Password policies, session controls, audit logs, and cloud-grade backups — with SSO available on the Ultra plan.",
      },
    ],
  },
  api: {
    headline: "Connect anything with a public REST API",
    intro:
      "A public REST API and webhooks, plus payment gateways, Google/Outlook calendar sync, door locks, IoT, and biometric devices — extend HospiOS to fit your exact stack.",
    highlights: [
      { title: "Public REST API & webhooks", body: "Build custom tools and receive real-time events as they happen." },
      { title: "Payments", body: "Razorpay, Stripe, PayPal, PayU, and Cashfree integrated out of the box." },
      { title: "Hardware & calendars", body: "Door locks, IoT, biometric devices, and Google/Outlook sync." },
    ],
    faqs: [
      {
        q: "How do I get API keys?",
        a: "Keys are issued from Security & Administration with scoped permissions and rate limits.",
      },
      {
        q: "Is there a sandbox environment?",
        a: "Yes — a full sandbox lets you test integrations before going to production.",
      },
    ],
  },
};
