import { Children, isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
}));
vi.mock("next/script", () => ({ default: "theme-script" }));
vi.mock("@/components/navigation-progress", () => ({
  NavigationProgress: () => null,
}));
vi.mock("@/components/service-worker-registration", () => ({
  ServiceWorkerRegistration: () => null,
}));

import RootLayout, { viewport } from "./layout";

async function loadBootstrap() {
  try {
    const bootstrapPath = "@/lib/theme-bootstrap";
    return (await import(/* @vite-ignore */ bootstrapPath)) as typeof import("@/lib/theme-bootstrap");
  } catch {
    return null;
  }
}

function findElements(node: ReactNode, type: string): Array<Record<string, unknown>> {
  if (!isValidElement(node)) return [];

  const ownMatch = node.type === type ? [node.props as Record<string, unknown>] : [];
  const props = node.props as { children?: ReactNode };
  return [
    ...ownMatch,
    ...Children.toArray(props.children).flatMap((child) => findElements(child, type)),
  ];
}

describe("root layout theme bootstrap", () => {
  it("exports the static light fallback with browser color-scheme support", () => {
    expect(viewport).toEqual({
      themeColor: "#f5f7fa",
      colorScheme: "light dark",
    });
  });

  it("suppresses the expected bootstrap hydration difference", () => {
    const layout = RootLayout({ children: <main>Portal</main> });
    expect(layout.type).toBe("html");
    expect(layout.props.suppressHydrationWarning).toBe(true);
  });

  it("installs the exact one-shot script before interactive hydration", async () => {
    const bootstrap = await loadBootstrap();
    expect(bootstrap).not.toBeNull();
    if (!bootstrap) return;

    const layout = RootLayout({ children: <main>Portal</main> });
    const scripts = findElements(layout, "theme-script");

    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({
      id: "theme-bootstrap",
      strategy: "beforeInteractive",
      dangerouslySetInnerHTML: { __html: bootstrap.themeBootstrapScript },
    });
  });

  it("does not handwrite a theme-color meta element", () => {
    const layout = RootLayout({ children: <main>Portal</main> });
    const metas = findElements(layout, "meta");

    expect(metas).not.toContainEqual(
      expect.objectContaining({ name: "theme-color" }),
    );
  });
});
