"use client";

import { type ReactNode } from "react";

interface SettingsLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}

export function SettingsLayout({ title, description, children, sidebar }: SettingsLayoutProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        {sidebar && (
          <nav className="lg:w-48 shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1">
              {sidebar}
            </div>
          </nav>
        )}
        <div className="flex-1 min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}

export function SettingsSection({ title, description, children, danger }: SettingsSectionProps) {
  return (
    <div className={`rounded-2xl border bg-white p-6 dark:bg-zinc-900 ${
      danger ? "border-red-200 dark:border-red-900" : "border-zinc-200 dark:border-zinc-800"
    }`}>
      <div className="mb-4">
        <h2 className={`text-lg font-semibold ${danger ? "text-red-600 dark:text-red-400" : ""}`}>
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface SettingsFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function SettingsField({ label, description, error, required, children }: SettingsFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface SettingsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggle({ label, description, checked, onChange, disabled }: SettingsToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

interface SettingsInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "email" | "password" | "url";
  disabled?: boolean;
  className?: string;
}

export function SettingsInput({ value, onChange, placeholder, type = "text", disabled, className = "" }: SettingsInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 ${className}`}
    />
  );
}

interface SettingsSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}

export function SettingsSelect({ value, onChange, options, disabled }: SettingsSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface SettingsSaveBarProps {
  onSave: () => void;
  onReset?: () => void;
  loading?: boolean;
  hasChanges?: boolean;
}

export function SettingsSaveBar({ onSave, onReset, loading, hasChanges }: SettingsSaveBarProps) {
  return (
    <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      {onReset && hasChanges && (
        <button
          onClick={onReset}
          disabled={loading}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Reset
        </button>
      )}
      <button
        onClick={onSave}
        disabled={loading || !hasChanges}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}

interface SettingsNavProps {
  items: Array<{
    href: string;
    label: string;
    active?: boolean;
  }>;
}

export function SettingsNav({ items }: SettingsNavProps) {
  return (
    <>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            item.active
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {item.label}
        </a>
      ))}
    </>
  );
}
