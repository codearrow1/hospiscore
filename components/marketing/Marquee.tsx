import type { ReactNode } from "react";

/**
 * CSS-only infinite marquee. Renders `children` twice inside a translating
 * track (the -50% translate loops seamlessly). Edge fade via .marquee-mask.
 * Pauses on hover. Pure CSS — server-safe.
 */
export default function Marquee({
  children,
  duration = 40,
  className = "",
}: {
  children: ReactNode;
  /** Seconds for one full loop (track = 2 copies). */
  duration?: number;
  className?: string;
}) {
  return (
    <div className={`marquee-mask w-full ${className}`}>
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
