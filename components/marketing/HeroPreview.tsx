"use client";

import { useState } from "react";
import UiMock, { type UiMockVariant } from "./UiMock";

/**
 * Hero platform preview — an interactive, honest operations dashboard built on
 * the existing UiMock (clearly labelled "UI preview", no fake screenshots).
 * Tab bar swaps the highlighted screen so visitors grasp the breadth fast.
 */

type PreviewTab = {
  id: string;
  label: string;
  mock: UiMockVariant;
};

const TABS: PreviewTab[] = [
  { id: "dashboard", label: "Live dashboard", mock: "dashboard" },
  { id: "frontdesk", label: "Front desk", mock: "frontdesk" },
  { id: "housekeeping", label: "Housekeeping", mock: "housekeeping" },
  { id: "revenue", label: "Revenue", mock: "revenue" },
];

export default function HeroPreview() {
  const [activeId, setActiveId] = useState(TABS[0].id);
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Explore HospiOS screens"
        className="mb-4 flex flex-wrap gap-2"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-indigo-400 hover:text-indigo-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="animate-fade-in" key={active.id}>
        <UiMock variant={active.mock} className="w-full" />
      </div>
    </div>
  );
}