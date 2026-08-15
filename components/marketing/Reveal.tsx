"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper. Adds `in-view` when the element enters the viewport
 * (IntersectionObserver), which drives the `.reveal` CSS transition. Honors
 * prefers-reduced-motion via the CSS fallback in globals.css. Renders as a
 * plain <div> so it never breaks layout.
 */
export default function Reveal({
  children,
  className = "",
  delay = 0,
  from = "up",
}: {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms (e.g. 80 * index for grids). */
  delay?: number;
  /** Entry direction/effect: up (default), left, right, or scale. */
  from?: "up" | "left" | "right" | "scale";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const revealClass =
    from === "up" ? "reveal" : `reveal-${from}`;

  return (
    <div
      ref={ref}
      className={`${revealClass} ${inView ? "in-view" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
