// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountForm } from "@/components/account-form";
import type { Profile } from "@/lib/types";

vi.mock("@/app/actions/accounts", () => ({
  createAccountAction: vi.fn(),
  reactivateStudentAction: vi.fn(),
  updateStudentGroupAction: vi.fn(),
}));

const mentor = {
  id: "00000000-0000-4000-8000-000000000002",
  full_name: "Active Mentor",
  is_active: true,
} as Profile;

describe("Student group administration controls", () => {
  afterEach(cleanup);

  it("requires an explicit group when creating a Student", () => {
    render(<AccountForm role="student" mentors={[mentor]} />);

    const group = screen.getByRole("combobox", { name: "Student group" });
    expect(group).toBeRequired();
    expect(group).toHaveValue("");
    expect(within(group).getByRole("option", { name: "Abhay Hostel" })).toHaveValue("abhay_hostel");
    expect(within(group).getByRole("option", { name: "Krishna Home" })).toHaveValue("krishna_home");
  });

  it("lets a Super Admin edit an existing Student group", async () => {
    const componentPath = "@/components/student-group-form";
    const componentModule = await import(/* @vite-ignore */ componentPath).catch(() => null) as typeof import("@/components/student-group-form") | null;
    expect(componentModule).not.toBeNull();
    if (!componentModule) return;
    render(<componentModule.StudentGroupForm studentId="00000000-0000-4000-8000-000000000001" studentGroup="abhay_hostel" />);

    const group = screen.getByRole("combobox", { name: "Student group" });
    expect(group).toHaveValue("abhay_hostel");
    expect(screen.getByRole("button", { name: "Save Group" })).toBeInTheDocument();
  });

  it("requires a group when reactivating an inactive Student", async () => {
    const componentPath = "@/components/student-reactivation-form";
    const componentModule = await import(/* @vite-ignore */ componentPath).catch(() => null) as typeof import("@/components/student-reactivation-form") | null;
    expect(componentModule).not.toBeNull();
    if (!componentModule) return;
    render(<componentModule.StudentReactivationForm studentId="00000000-0000-4000-8000-000000000001" studentName="Inactive Student" studentGroup="krishna_home" />);

    const group = screen.getByRole("combobox", { name: "Group for Inactive Student" });
    expect(group).toBeRequired();
    expect(group).toHaveValue("krishna_home");
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
  });
});
