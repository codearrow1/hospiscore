"use client";

import { useEffect, useState } from "react";

/**
 * Rotating word/phrase. Cycles through `words` every `interval` ms with a
 * quick fade-up. Stops cycling when the user prefers reduced motion.
 */
export default function RotatingWords({
  words,
  interval = 2600,
  className = "",
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    if (words.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, interval);
    return () => clearInterval(id);
  }, [words.length, interval]);

  const word = words[index] ?? words[0];

  return (
    <span className={`inline-block ${className}`}>
      <span key={index} className="inline-block animate-fade-up" aria-hidden="true">
        {word}
      </span>
    </span>
  );
}
