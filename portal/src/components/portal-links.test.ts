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
});
