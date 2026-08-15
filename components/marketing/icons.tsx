import type { ReactNode } from "react";

/**
 * Marketing icon set. Server-safe inline SVGs (stroke-based, lucide-style).
 */

export type IconName =
  | "dashboard"
  | "frontdesk"
  | "calendar"
  | "key"
  | "guest"
  | "smartphone"
  | "globe"
  | "chat"
  | "utensils"
  | "sparkle"
  | "shirt"
  | "wrench"
  | "box"
  | "coins"
  | "users"
  | "network"
  | "trend"
  | "chart"
  | "megaphone"
  | "building"
  | "shield"
  | "plug"
  | "ai"
  | "star";

const ICON_PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  frontdesk: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 9v11" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4" />
      <path d="m10.5 12.5 9-9" />
      <path d="M15 8l3 3" />
      <path d="M18 5l2 2" />
    </>
  ),
  guest: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
      <path d="M16 4.2a4 4 0 0 1 0 7.6" />
      <path d="M22 20v-1a7 7 0 0 0-4-6.3" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M12 18h.01" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18" />
      <path d="M12 3a13 13 0 0 0 0 18" />
    </>
  ),
  chat: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  utensils: (
    <>
      <path d="M6 2v7M3 2v5.5A2.5 2.5 0 0 0 8 7.5V2M6 9v13" />
      <path d="M18 2v13" />
      <path d="M15 2v6a3 3 0 0 0 6 0V2M18 15v8" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.7 4.6L18.3 9l-4.6 1.7L12 15.3l-1.7-4.6L5.7 9l4.6-1.4z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  shirt: (
    <path d="M9 3H6L3 6l2.5 2L7 6.5V21h10V6.5L18.5 8 21 6l-3-3h-3" />
  ),
  wrench: (
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3z" />
  ),
  box: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  coins: (
    <>
      <circle cx="9" cy="9" r="6" />
      <circle cx="15.5" cy="14.5" r="6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 21a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 21a6.5 6.5 0 0 0-3-5.7" />
    </>
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M10.5 6.3 6.6 17" />
      <path d="M13.5 6.3l3.9 10.7" />
      <path d="M7.5 19h9" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7h-5" />
      <path d="M21 7v5" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 4 3 6-7" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11l13-5v12L3 13v-2z" />
      <path d="M16 10h3a2 2 0 0 1 0 4h-3" />
      <path d="M11.5 16.5a2.5 2.5 0 0 1-3 0" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 21v-5h6v5" />
      <path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01" />
    </>
  ),
  shield: (
    <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />
  ),
  plug: (
    <>
      <path d="M9 2v5M15 2v5" />
      <path d="M6 7h12v4a6 6 0 0 1-12 0z" />
      <path d="M12 17v5" />
    </>
  ),
  ai: (
    <>
      <path d="M12 3l1.8 4.8L18.6 9l-4.8 1.2L12 15l-1.8-4.8L5.4 9l4.8-1.2z" />
      <path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </>
  ),
  star: (
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8l-6.2 3.2L7 14.2 2 9.3l6.9-1z" />
  ),
};

export default function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
