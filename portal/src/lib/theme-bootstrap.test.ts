// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadBootstrap() {
  try {
    const bootstrapPath = "@/lib/theme-bootstrap";
    return (await import(/* @vite-ignore */ bootstrapPath)) as typeof import("@/lib/theme-bootstrap");
  } catch {
    return null;
  }
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");

function setMatchMedia(matches: boolean) {
  const addEventListener = vi.fn();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches, addEventListener })),
  });
  return addEventListener;
}

async function executeBootstrap() {
  const bootstrap = await loadBootstrap();
  expect(bootstrap).not.toBeNull();
  if (!bootstrap) return false;
  window.eval(bootstrap.themeBootstrapScript);
  return true;
}

describe("theme bootstrap script", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", originalMatchMedia);
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });

  it.each([
    ["light", true, "light", "#f5f7fa"],
    ["dark", false, "dark", "#081f3d"],
    ["system", false, "light", "#f5f7fa"],
    ["system", true, "dark", "#081f3d"],
    ["sepia", true, "dark", "#081f3d"],
  ] as const)(
    "applies stored %s with system dark=%s before paint",
    async (stored, systemPrefersDark, expectedTheme, expectedColor) => {
      window.localStorage.setItem("abhay-hostel-theme", stored);
      setMatchMedia(systemPrefersDark);

      if (!(await executeBootstrap())) return;

      expect(document.documentElement).toHaveAttribute("data-theme", expectedTheme);
      expect(document.documentElement.style.colorScheme).toBe(expectedTheme);
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        expectedColor,
      );
    },
  );

  it("falls back to System when reading storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    setMatchMedia(true);

    if (!(await executeBootstrap())) return;

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#081f3d",
    );
  });

  it("resolves System to light when matchMedia is absent", async () => {
    window.localStorage.setItem("abhay-hostel-theme", "system");

    if (!(await executeBootstrap())) return;

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#f5f7fa",
    );
  });

  it("does not fail when the theme-color meta is absent", async () => {
    window.localStorage.setItem("abhay-hostel-theme", "dark");
    document.querySelector('meta[name="theme-color"]')?.remove();

    if (!(await executeBootstrap())) return;

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
  });

  it("performs a one-shot system lookup without registering a listener", async () => {
    window.localStorage.setItem("abhay-hostel-theme", "system");
    const addEventListener = setMatchMedia(true);

    if (!(await executeBootstrap())) return;

    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(addEventListener).not.toHaveBeenCalled();
  });
});
