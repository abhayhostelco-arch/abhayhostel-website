import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/account-menu";
import { ThemeProvider } from "@/components/theme-provider";
import type { Profile } from "@/lib/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/student" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock("@/app/actions/auth", () => ({ logoutAction: vi.fn() }));

const student: Profile = {
  id: "00000000-0000-4000-8000-000000000001", role: "student", full_name: "Student One",
  email: "student@example.com", phone: null, academy_label: null, joined_on: null,
  is_active: true, must_change_password: false, created_by: null, mentor_id: null,
  created_at: "2026-01-01", updated_at: "2026-01-01",
};

describe("AccountMenu profile picture", () => {
  it("renders the signed profile picture in the top account control", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider><AccountMenu profile={student} profileHref="/student/settings" avatarUrl="https://portal.example/avatar" /></ThemeProvider>,
    );

    expect(html).toContain('src="https://portal.example/avatar"');
    expect(html).toContain("alt=\"Student One&#x27;s profile picture\"");
  });
});
