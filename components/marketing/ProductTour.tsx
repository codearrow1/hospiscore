"use client";

import { useState } from "react";
import UiMock, { type UiMockVariant } from "./UiMock";

/**
 * Interactive product tour: tab bar on the left, live UiMock on the right.
 * Selecting a tab switches the highlighted mock + copy (no auto-rotation to
 * keep motion predictable and respect reduced-motion users).
 */

type TourStep = {
  id: string;
  icon: "dashboard" | "frontdesk" | "housekeeping" | "revenue" | "guest" | "calendar";
  label: string;
  title: string;
  body: string;
  bullets: string[];
  mock: UiMockVariant;
};

const STEPS: TourStep[] = [
  {
    id: "dashboard",
    icon: "dashboard",
    label: "Dashboard",
    title: "Your whole property, one screen",
    body: "Occupancy, revenue, arrivals and alerts update in real time as bookings land and rooms turn over.",
    bullets: ["Live occupancy & RevPAR at a glance", "Today's arrivals, departures and tasks", "Alerts for overbookings and rate drops"],
    mock: "dashboard",
  },
  {
    id: "frontdesk",
    icon: "frontdesk",
    label: "Front desk",
    title: "Check in with one click",
    body: "A boarding-pass-fast front desk. Pull up the reservation, verify ID, swipe a card and issue keys in seconds.",
    bullets: ["Same-day arrivals queue", "Deposits & incidental holds built in", "Digital keys pushed to guest phones"],
    mock: "frontdesk",
  },
  {
    id: "housekeeping",
    icon: "housekeeping",
    label: "Housekeeping",
    title: "Rooms that run themselves",
    body: "Statuses flow from checkout straight into the housekeeping board, and rooms are assigned automatically.",
    bullets: ["Live clean / dirty / inspected board", "Smart assignment by workload", "Guest requests routed instantly"],
    mock: "housekeeping",
  },
  {
    id: "revenue",
    icon: "revenue",
    label: "Revenue",
    title: "Pricing intelligence, not guesswork",
    body: "Rate plans respond to demand with demand-based pricing and nightly revenue forecasting.",
    bullets: ["Demand-based pricing suggestions", "RevPAR, ADR & occupancy forecasting", "Channel-wise rate parity checks"],
    mock: "revenue",
  },
  {
    id: "guest",
    icon: "guest",
    label: "Guest profiles",
    title: "Know every guest",
    body: "Preferences, stay history and message threads in one profile. Greet returning guests by name — every time.",
    bullets: ["360° guest profile & stay history", "In-app messaging in 40+ languages", "Preference-led upsells at booking"],
    mock: "guest",
  },
  {
    id: "calendar",
    icon: "calendar",
    label: "Calendar",
    title: "Plan around the stay grid",
    body: "A drag-and-drop multi-property calendar that shows every room and reservation across dates.",
    bullets: ["Drag-and-drop reservations", "Multi-property stay grid", "Channel & source colour coding"],
    mock: "calendar",
  },
];

const DOT: Record<TourStep["icon"], string> = {
  dashboard: "bg-indigo-400",
  frontdesk: "bg-sky-400",
  housekeeping: "bg-emerald-400",
  revenue: "bg-amber-400",
  guest: "bg-violet-400",
  calendar: "bg-rose-400",
};

export default function ProductTour() {
  const [activeId, setActiveId] = useState(STEPS[0].id);
  const active = STEPS.find((s) => s.id === activeId) ?? STEPS[0];

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[300px_1fr]">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0" role="tablist" aria-label="Product tour">
        {STEPS.map((step) => {
          const selected = step.id === activeId;
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(step.id)}
              className={`flex min-w-[240px] items-start gap-3 rounded-xl border p-4 text-left transition lg:min-w-0 ${
                selected
                  ? "border-indigo-500/60 bg-indigo-950/40"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${DOT[step.icon]}`} aria-hidden="true" />
              <span>
                <span className={`block text-sm font-semibold ${selected ? "text-zinc-50" : "text-zinc-300"}`}>
                  {step.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{step.title}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div role="tabpanel" aria-labelledby={`tab-${active.id}`} className="min-w-0">
        <div key={active.id} className="animate-fade-in">
          <UiMock variant={active.mock} className="w-full max-w-3xl" />
          <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <h3 className="text-xl font-semibold text-zinc-50">{active.title}</h3>
              <p className="mt-2 leading-relaxed text-zinc-400">{active.body}</p>
            </div>
            <ul className="space-y-2">
              {active.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-zinc-300">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
