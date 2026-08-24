"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputCls } from "./Field";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Lightweight combobox: text filter over a static option list with full
 * keyboard support (arrows/enter/escape) and accessible listbox semantics.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  disabled = false,
  id,
}: {
  options: SearchableSelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else setQuery("");
  }, [open]);

  const selected = options.find((o) => o.value === value);

  function commit(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative" id={id}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected ? "" : "text-zinc-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          role="listbox"
          id={listId}
        >
          <div className="border-b border-line p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && filtered[active]) {
                  e.preventDefault();
                  commit(filtered[active].value);
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-zinc-200 bg-surface-subtle px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-zinc-400">No matches</p>
            )}
            {filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => commit(o.value)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  i === active ? "bg-brand-soft" : ""
                } ${o.value === value ? "font-semibold" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {o.description && (
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{o.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
