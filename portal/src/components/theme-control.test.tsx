// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "@/components/theme-control";
import { ThemeProvider } from "@/components/theme-provider";

function installMatchMedia(matches = false) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

describe("ThemeControl", () => {
  beforeEach(() => {
    localStorage.clear();
    installMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("server-renders an unselected disabled busy native radio group", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<ThemeProvider><ThemeControl /></ThemeProvider>);
    const fieldset = container.querySelector("fieldset");
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

    expect(fieldset).toBeDisabled();
    expect(fieldset).toHaveAttribute("aria-busy", "true");
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => !radio.checked)).toBe(true);
  });

  it("labels native radios and synchronizes two controls with unique names and IDs", async () => {
    render(<ThemeProvider><ThemeControl /><ThemeControl /></ThemeProvider>);
    await waitFor(() => expect(screen.getAllByRole("group")).toHaveLength(2));
    const groups = screen.getAllByRole("group");
    await waitFor(() => expect(groups[0]).not.toBeDisabled());

    const firstRadios = within(groups[0]).getAllByRole<HTMLInputElement>("radio");
    const secondRadios = within(groups[1]).getAllByRole<HTMLInputElement>("radio");
    expect(within(groups[0]).getByText("Theme")).toBeInTheDocument();
    expect(firstRadios.map((radio) => radio.value)).toEqual(["system", "light", "dark"]);
    expect(new Set(firstRadios.map((radio) => radio.name)).size).toBe(1);
    expect(firstRadios[0].name).not.toBe(secondRadios[0].name);
    expect(new Set([...firstRadios, ...secondRadios].map((radio) => radio.id)).size).toBe(6);

    fireEvent.click(within(groups[0]).getByLabelText("Dark"));
    expect(within(groups[0]).getByLabelText("Dark")).toBeChecked();
    expect(within(groups[1]).getByLabelText("Dark")).toBeChecked();

    fireEvent.click(within(groups[1]).getByLabelText("System"));
    expect(within(groups[0]).getByLabelText("System")).toBeChecked();
    expect(within(groups[1]).getByLabelText("System")).toBeChecked();
  });

  it("leaves grouped native radio arrow-key behavior to the browser", async () => {
    render(<ThemeProvider><ThemeControl /></ThemeProvider>);
    const group = screen.getByRole("group");
    await waitFor(() => expect(group).not.toBeDisabled());
    const radios = within(group).getAllByRole<HTMLInputElement>("radio");
    const arrowRight = createEvent.keyDown(radios[0], { key: "ArrowRight" });

    radios[0].focus();
    fireEvent(radios[0], arrowRight);

    expect(radios.every((radio) => radio.tagName === "INPUT" && radio.type === "radio")).toBe(true);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    expect(arrowRight.defaultPrevented).toBe(false);
  });
});
