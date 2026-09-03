"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { track, type PublicEventName } from "@/lib/marketing/track-client";

/**
 * Client wrapper that turns any CTA link into a tracked conversion event.
 * Reuses the shared public track() helper so analytics stays in one place.
 * Renders children on top of a Next <Link>; safe, fire-and-forget analytics.
 */

export default function TrackCta({
  href,
  event,
  meta,
  onClick,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  event: PublicEventName;
  meta?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={() => {
        track(event, meta);
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}