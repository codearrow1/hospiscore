"use client";

import { useState, useEffect, useCallback } from "react";

interface Setting {
  key: string;
  value: unknown;
  type: string;
  defaultValue: unknown;
  description: string;
  category: string;
  options?: string[];
  min?: number;
  max?: number;
}

interface UseSettingsResult {
  settings: Setting[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSettings(category?: string): UseSettingsResult {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = category ? `/api/settings?category=${category}` : "/api/settings";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await res.json();
      setSettings(data.settings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, refetch: fetchSettings };
}

export function useSetting(key: string) {
  const [value, setValue] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSetting() {
      try {
        const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error("Failed to fetch setting");
        const data = await res.json();
        if (!cancelled) {
          setValue(data.value);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to fetch setting");
          setLoading(false);
        }
      }
    }
    loadSetting();
    return () => { cancelled = true; };
  }, [key]);

  return { value, loading, error };
}

interface UseSettingsFormResult {
  values: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
  hasChanges: boolean;
  reset: () => void;
  save: () => Promise<void>;
  saving: boolean;
  error: string | null;
  success: string | null;
  clearMessages: () => void;
}

export function useSettingsForm(initialSettings: Setting[]): UseSettingsFormResult {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const s of initialSettings) {
      map[s.key] = s.value;
    }
    return map;
  });
  const [initial, setInitial] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const s of initialSettings) {
      map[s.key] = s.value;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const setValue = useCallback((key: string, value: unknown) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const hasChanges = JSON.stringify(values) !== JSON.stringify(initial);

  const reset = useCallback(() => {
    setValues({ ...initial });
    setError(null);
    setSuccess(null);
  }, [initial]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updates = Object.entries(values)
        .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key]))
        .map(([key, value]) => ({ key, value }));

      if (updates.length === 0) return;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings");
      }
      setInitial({ ...values });
      setSuccess(`${updates.length} settings saved successfully`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [values, initial]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return { values, setValue, hasChanges, reset, save, saving, error, success, clearMessages };
}
