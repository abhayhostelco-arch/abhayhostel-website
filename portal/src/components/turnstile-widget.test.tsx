// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

vi.mock("next/script", () => ({ default: ({ onReady }: { onReady?: () => void }) => <button data-testid="script" onClick={onReady}>script</button> }));

describe("TurnstileWidget lifecycle", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key"); });
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("removes the old generation and renders the resolved theme after theme changes", async () => {
    const widgets: Array<{ callback: (token: string) => void }> = [];
    const remove = vi.fn();
    const renderWidget = vi.fn((_container: HTMLElement, options: { theme: string; callback: (token: string) => void }) => { widgets.push(options); return String(widgets.length); });
    vi.stubGlobal("turnstile", { render: renderWidget, remove, reset: vi.fn() });
    const Toggle = () => { const { setPreference } = useTheme(); return <button onClick={() => setPreference("dark")}>toggle</button>; };
    const Harness = () => <ThemeProvider><TurnstileWidget /><Toggle /></ThemeProvider>;
    const view = render(<Harness />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    expect(renderWidget.mock.calls[0][1]).toMatchObject({ theme: "light" });
    fireEvent.click(view.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("1"));
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(renderWidget.mock.calls[1][1]).toMatchObject({ theme: "dark" });
  });

  it("waits for script readiness when the API is initially unavailable", async () => {
    const renderWidget = vi.fn(() => "1");
    vi.stubGlobal("turnstile", undefined);
    const view = render(<ThemeProvider><TurnstileWidget /></ThemeProvider>);
    expect(renderWidget).not.toHaveBeenCalled();
    vi.stubGlobal("turnstile", { render: renderWidget, remove: vi.fn(), reset: vi.fn() });
    fireEvent.click(view.getByTestId("script"));
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
  });

  it("rejects stale callbacks, invalidates tokens on reset, and removes on unmount", async () => {
    const callbacks: Array<(token: string) => void> = [];
    const reset = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal("turnstile", { render: vi.fn((_c, o) => { callbacks.push(o.callback); return String(callbacks.length); }), remove, reset });
    const ready = vi.fn();
    const view = render(<ThemeProvider><TurnstileWidget onReadyChange={ready} resetSignal={undefined} /></ThemeProvider>);
    await waitFor(() => expect(callbacks).toHaveLength(1));
    callbacks[0]("token");
    await waitFor(() => expect(view.container.querySelector<HTMLInputElement>("input")?.value).toBe("token"));
    view.rerender(<ThemeProvider><TurnstileWidget onReadyChange={ready} resetSignal={{}} /></ThemeProvider>);
    await waitFor(() => expect(reset).toHaveBeenCalled());
    const widgetId = reset.mock.calls[0][0];
    expect(view.container.querySelector<HTMLInputElement>("input")?.value).toBe("");
    view.unmount();
    expect(remove).toHaveBeenCalledWith(widgetId);
  });
});
