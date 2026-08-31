"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyResolvedTheme, readThemePreference, resolveTheme, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  hydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const nextPreference = readThemePreference();
      const nextResolvedTheme = resolveTheme(
        nextPreference,
        getSystemPreference()?.matches ?? false,
      );
      setPreferenceState(nextPreference);
      setResolvedTheme(nextResolvedTheme);
      applyResolvedTheme(nextResolvedTheme);
      setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const media = preference === "system" ? getSystemPreference() : null;
    const updateTheme = () => {
      const resolved = resolveTheme(preference, media?.matches ?? false);
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };

    updateTheme();
    media?.addEventListener("change", updateTheme);
    return () => media?.removeEventListener("change", updateTheme);
  }, [hydrated, preference]);

  useEffect(() => {
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextPreference = event.newValue;
      setPreferenceState(
        nextPreference === "system" || nextPreference === "light" || nextPreference === "dark"
          ? nextPreference
          : "system",
      );
    };

    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // The in-memory preference remains authoritative for this tab.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, hydrated, setPreference }),
    [preference, resolvedTheme, hydrated, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}
