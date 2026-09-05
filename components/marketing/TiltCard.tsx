"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * Card with a pointer-tracked 3D tilt. Writes rotateX/rotateY CSS transforms
 * inline on pointer move (using --tilt-x/--tilt-y) so a `.tilt-inner` child can
 * translateZ out of the plane for depth. The transform is reset on leave.
 *
 * Accessibility: purely decorative; reduced-motion is honored via the
 * `.tilt-card` transition/transform CSS override in globals.css. Tilt is
 * disabled on coarse-pointer (touch) devices — tracking during scroll caused
 * cards to jitter while scrolling on mobile.
 */
export default function TiltCard({
  children,
  className = "",
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const coarse = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      coarse.current = window.matchMedia("(pointer: coarse)").matches;
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (coarse.current) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 2 * max;
      const rotateX = (0.5 - py) * 2 * max;
      el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    },
    [max],
  );

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`tilt-card ${className}`}
    >
      {children}
    </div>
  );
}
