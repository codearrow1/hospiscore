"use client";

import { useEffect, useState } from "react";

/**
 * Rotating word/phrase. Cycles through `words` every `interval` ms with a
 * quick fade-up. Reserves the width of the longest word so the surrounding
 * headline never re-flows when the word swaps. Stops cycling when the user
 * prefers reduced motion.
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
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), words[0] ?? "");

  return (
    <span className={`relative inline-grid ${className}`}>
      <span className="invisible" aria-hidden="true">
        {longest}
      </span>
      <span
        key={index}
        className="absolute inset-0 animate-fade-up"
        aria-hidden="true"
      >
        {word}
      </span>
      <span aria-live="polite" className="sr-only">
        {word}
      </span>
    </span>
  );
}