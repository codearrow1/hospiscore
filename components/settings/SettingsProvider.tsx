"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SettingsContextType {
  save: (key: string, value: unknown) => Promise<void>;
  saveBatch: (updates: Array<{ key: string; value: unknown }>) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: string | null;
  clearMessages: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const save = useCallback(async (key: string, value: unknown) => {
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save setting");
      }
      setSuccess("Setting saved successfully");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save setting");
    } finally {
      setLoading(false);
    }
  }, [router, clearMessages]);

  const saveBatch = useCallback(async (updates: Array<{ key: string; value: unknown }>) => {
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings");
      }
      setSuccess(`${updates.length} settings saved successfully`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }, [router, clearMessages]);

  return (
    <SettingsContext.Provider value={{ save, saveBatch, loading, error, success, clearMessages }}>
      {children}
    </SettingsContext.Provider>
  );
}
