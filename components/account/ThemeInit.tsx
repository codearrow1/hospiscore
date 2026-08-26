"use client";

import { useEffect } from "react";

/**
 * Reads `hs-theme` from localStorage on mount and applies the `dark` class
 * to <html> so theme persists across page navigations.
 */
export default function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("hs-theme") as "light" | "dark" | "system" | null;
    const mode = stored ?? "system";
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }
  }, []);
  return null;
}
