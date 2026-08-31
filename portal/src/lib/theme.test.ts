// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";

async function loadTheme() {
  try {
    const themePath = "@/lib/theme";
    return (await import(/* @vite-ignore */ themePath)) as typeof import("@/lib/theme");
  } catch {
    return null;
  }
}

describe("theme contract", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
  });

  it("exposes the browser-local preference and runtime color contract", async () => {
    const theme = await loadTheme();
    expect(theme).not.toBeNull();
    if (!theme) return;

    expect(theme.THEME_STORAGE_KEY).toBe("abhay-hostel-theme");
    expect(theme.LIGHT_THEME_COLOR).toBe("#f5f7fa");
    expect(theme.DARK_THEME_COLOR).toBe("#081f3d");
  });

  it.each([
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
    ["system", false, "light"],
    ["system", true, "dark"],
  ] as const)(
    "resolves %s with system dark=%s to %s",
    async (preference, systemPrefersDark, expected) => {
      const theme = await loadTheme();
      expect(theme).not.toBeNull();
      if (!theme) return;

      expect(theme.resolveTheme(preference, systemPrefersDark)).toBe(expected);
    },
  );

  it.each([
    [null, "system"],
    ["", "system"],
    ["sepia", "system"],
    ["SYSTEM", "system"],
    ["system", "system"],
    ["light", "light"],
    ["dark", "dark"],
  ] as const)("reads stored value %s as %s", async (stored, expected) => {
    const theme = await loadTheme();
    expect(theme).not.toBeNull();
    if (!theme) return;

    const storage = { getItem: () => stored };
    expect(theme.readThemePreference(storage)).toBe(expected);
  });

  it("falls back to System when storage is inaccessible", async () => {
    const theme = await loadTheme();
    expect(theme).not.toBeNull();
    if (!theme) return;

    const storage = {
      getItem: () => {
        throw new Error("storage denied");
      },
    };

    expect(theme.readThemePreference(storage)).toBe("system");
  });

  it("falls back to System when browser storage itself is inaccessible", async () => {
    const theme = await loadTheme();
    expect(theme).not.toBeNull();
    if (!theme) return;

    const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("storage denied");
      },
    });

    try {
      expect(theme.readThemePreference()).toBe("system");
    } finally {
      if (originalStorage) {
        Object.defineProperty(window, "localStorage", originalStorage);
      }
    }
  });

  it.each([
    ["light", "#f5f7fa"],
    ["dark", "#081f3d"],
  ] as const)("applies the resolved %s theme to the document", async (resolved, color) => {
    const theme = await loadTheme();
    expect(theme).not.toBeNull();
    if (!theme) return;

    theme.applyResolvedTheme(resolved, document);

    expect(document.documentElement).toHaveAttribute("data-theme", resolved);
    expect(document.documentElement.style.colorScheme).toBe(resolved);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      color,
    );
  });

  it("still applies the root theme when the theme-color meta is absent", async () => {
    const theme = await loadTheme();
    expect(theme).not.toBeNull();
    if (!theme) return;
    document.querySelector('meta[name="theme-color"]')?.remove();

    expect(() => theme.applyResolvedTheme("dark", document)).not.toThrow();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
