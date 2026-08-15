"use client";

import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Card with a cursor-tracking radial spotlight. On hover/move the mouse
 * position is written to CSS vars (--spot-x/--spot-y) that the inner radial
 * gradient uses, giving a soft "flashlight" highlight over the card.
 *
 * Accessibility: the highlight is purely decorative (aria-hidden) and the
 * card itself stays a normal element — keyboard focus reveals it via
 * :focus-within.
 */
export default function SpotlightCard({
  children,
  className = "",
  color = "rgba(129, 140, 248, 0.18)",
  radius = 420,
}: {
  children: ReactNode;
  className?: string;
  /** Color of the spotlight glow. */
  color?: string;
  /** Radius (px) of the spotlight circle. */
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }, []);

  const styles = {
    "--spot-x": "50%",
    "--spot-y": "0%",
  } as CSSProperties;

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={`group/spot relative overflow-hidden ${className}`}
      style={styles}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100 group-focus-within:opacity-100"
        style={{
          background: `radial-gradient(${radius}px circle at var(--spot-x) var(--spot-y), ${color}, transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}
