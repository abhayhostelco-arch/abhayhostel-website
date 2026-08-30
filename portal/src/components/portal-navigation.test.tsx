// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { MobilePortalNavigation, type PortalLink } from "@/components/portal-navigation";
import type { Profile } from "@/lib/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/student" }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/app/actions/auth", () => ({ logoutAction: vi.fn() }));

const profile: Profile = {
  id: "student-1", role: "student", full_name: "Student One", email: "student@example.com",
  phone: null, academy_label: null, joined_on: null, is_active: true,
  must_change_password: false, created_by: null, mentor_id: null,
  created_at: "2026-01-01", updated_at: "2026-01-01",
};
const links: PortalLink[] = [
  { href: "/student", label: "Dashboard", icon: "dashboard", group: "Overview" },
];

function installMatchMedia() {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false, media: "(prefers-color-scheme: dark)", onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
}

describe("MobilePortalNavigation theme focus", () => {
  beforeEach(() => { localStorage.clear(); installMatchMedia(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("focuses the sheet and wraps forward and reverse Tab through hydrated theme radios", async () => {
    render(<ThemeProvider><MobilePortalNavigation links={links} profile={profile} /></ThemeProvider>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Open all navigation" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Open all navigation" }));

    const dialog = screen.getByRole("dialog");
    const profileLink = within(dialog).getByRole("link", { name: /Student One/ });
    const darkRadio = within(dialog).getByRole("radio", { name: "Dark" });
    await waitFor(() => expect(profileLink).toHaveFocus());
    expect(darkRadio).toBeEnabled();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(darkRadio).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(profileLink).toHaveFocus();
  });

  it("excludes fieldset-disabled theme radios from the pre-hydration focus trap", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    flushSync(() => root.render(
      <ThemeProvider><MobilePortalNavigation links={links} profile={profile} /></ThemeProvider>,
    ));
    const openButton = within(container).getByRole("button", { name: "Open all navigation" });
    flushSync(() => openButton.click());

    const dialog = within(container).getByRole("dialog");
    const profileLink = within(dialog).getByRole("link", { name: /Student One/ });
    const radios = within(dialog).getAllByRole<HTMLInputElement>("radio");
    const signOut = within(dialog).getByRole("button", { name: "Sign Out" });
    expect(radios.every((radio) => radio.matches(":disabled"))).toBe(true);
    expect(profileLink).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(signOut).toHaveFocus();

    flushSync(() => root.unmount());
    container.remove();
  });
});
