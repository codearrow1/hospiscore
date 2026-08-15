import Link from "next/link";
import Icon from "@/components/marketing/icons";
import type { IconName } from "@/components/marketing/icons";

/**
 * "Core hospitality tools" hover cards — flagship modules that lift forward
 * on hover, mirroring the Roomnexa homepage treatment.
 */

interface Tool {
  slug: string;
  icon: IconName;
  name: string;
  headline: string;
  body: string;
  bullets: string[];
}

const TOOLS: Tool[] = [
  {
    slug: "bookingengine",
    icon: "globe",
    name: "Booking Engine",
    headline: "Turn lookers into guests on every device",
    body: "A fast, branded booking flow on web and mobile — designed to convert direct traffic without OTA commission.",
    bullets: [
      "Mobile-first booking with instant confirmation",
      "Branded upsells and best-price guarantees",
      "Real-time availability tied to your PMS",
    ],
  },
  {
    slug: "frontdesk",
    icon: "frontdesk",
    name: "PMS",
    headline: "Run every room, guest, and task from one hub",
    body: "Your property command center — rooms, housekeeping, front desk, and guest profiles stay in sync without switching tools.",
    bullets: [
      "Live room board with occupancy at a glance",
      "Guest folios, profiles, and stay history in one place",
      "Housekeeping tasks synced with front desk instantly",
    ],
  },
  {
    slug: "channel",
    icon: "network",
    name: "Channel Manager",
    headline: "Connect 50+ booking channels without the overhead",
    body: "Inventory, rates, and restrictions sync two-way across every major OTA in real time.",
    bullets: [
      "Two-way availability, rate & restriction sync",
      "Room and rate-plan mapping done once",
      "Distribution dashboard with OTA analytics",
    ],
  },
];

export default function CoreTools() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {TOOLS.map((tool) => (
        <Link
          key={tool.slug}
          href={`/platform/${tool.slug}`}
          className="glow-border group relative flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 transition duration-300 hover:-translate-y-2 hover:border-indigo-500/60 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-indigo-950/40"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300 transition duration-300 group-hover:scale-110 group-hover:bg-indigo-500/20">
            <Icon name={tool.icon} className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            {tool.name}
          </p>
          <h3 className="mt-2 text-lg font-bold leading-snug text-zinc-50">{tool.headline}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{tool.body}</p>
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-zinc-800 pt-4">
            {tool.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-400">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
          <span className="btn-arrow mt-5 inline-flex items-center gap-1 text-sm font-semibold text-indigo-400">
            Explore {tool.name}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </span>
        </Link>
      ))}
    </div>
  );
}
