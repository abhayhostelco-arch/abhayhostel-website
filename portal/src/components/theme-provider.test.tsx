// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DARK_THEME_COLOR, LIGHT_THEME_COLOR, THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

type MediaListener = (event: MediaQueryListEvent) => void;

function installMatchMedia(matches = false) {
  const listeners = new Set<MediaListener>();
  const media = {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: MediaListener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: MediaListener) => listeners.delete(listener)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  const matchMedia = vi.fn(() => media);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    media,
    matchMedia,
    change(nextMatches: boolean) {
      Object.defineProperty(media, "matches", { configurable: true, value: nextMatches });
      listeners.forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent));
    },
  };
}

function Harness() {
  const theme = useTheme();
  return <>
    <output data-testid="preference">{theme.preference}</output>
    <output data-testid="resolved">{theme.resolvedTheme}</output>
    <output data-testid="hydrated">{String(theme.hydrated)}</output>
    {(["system", "light", "dark"] as const).map((preference) => (
      <button key={preference} onClick={() => theme.setPreference(preference)}>{preference}</button>
    ))}
  </>;
}

function renderProvider() {
  return render(<ThemeProvider><Harness /></ThemeProvider>);
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    document.head.innerHTML = '<meta name="theme-color" content="bootstrap">';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves bootstrap DOM until storage is read, then applies all browser effects", async () => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
      return "light";
    });
    installMatchMedia(true);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    expect(screen.getByTestId("preference")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", LIGHT_THEME_COLOR);
  });

  it("sets every preference and keeps updating when storage writes fail", async () => {
    const media = installMatchMedia(true);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));

    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(setItem).toHaveBeenLastCalledWith(THEME_STORAGE_KEY, "light");

    setItem.mockImplementation(() => { throw new Error("storage unavailable"); });
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("preference")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", DARK_THEME_COLOR);

    fireEvent.click(screen.getByRole("button", { name: "system" }));
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(media.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  it("listens to system changes only while System is selected", async () => {
    const media = installMatchMedia(false);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    expect(media.media.addEventListener).toHaveBeenCalledTimes(1);

    act(() => media.change(true));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");

    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(media.media.removeEventListener).toHaveBeenCalledTimes(1);
    act(() => media.change(false));
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it.each([
    ["valid", "dark", "dark", "dark", DARK_THEME_COLOR],
    ["removed", null, "system", "light", LIGHT_THEME_COLOR],
    ["invalid", "sepia", "system", "light", LIGHT_THEME_COLOR],
  ])("handles %s theme storage events", async (_case, newValue, expected, resolved, themeColor) => {
    installMatchMedia(false);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));

    act(() => window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue })));

    expect(screen.getByTestId("preference")).toHaveTextContent(expected);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe(resolved));
    expect(document.documentElement.style.colorScheme).toBe(resolved);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", themeColor);
  });

  it("ignores unrelated storage events", async () => {
    installMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("preference")).toHaveTextContent("light"));

    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "dark" })));

    expect(screen.getByTestId("preference")).toHaveTextContent("light");
  });
});
