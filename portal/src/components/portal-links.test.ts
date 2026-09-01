import { describe, expect, it } from "vitest";
import { getPortalLinks } from "./portal-links";

describe("getPortalLinks", () => {
  it("includes Profile Settings in the Super Admin system navigation", () => {
    expect(getPortalLinks("super_admin")).toContainEqual({
      href: "/admin/profile",
      label: "Profile Settings",
      icon: "settings",
      group: "System",
    });
  });

  it("makes monthly payments reachable for Students, Mentors, and the Super Admin", () => {
    expect(getPortalLinks("student")).toContainEqual(expect.objectContaining({ href: "/student/payments", label: "Payments" }));
    expect(getPortalLinks("admin")).toContainEqual(expect.objectContaining({ href: "/mentor/payments", label: "Payments" }));
    expect(getPortalLinks("super_admin")).toContainEqual(expect.objectContaining({ href: "/admin/payments", label: "Payments" }));
  });
});
