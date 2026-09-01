import type { PortalLink } from "./portal-navigation";
import type { Profile } from "@/lib/types";

export function getPortalLinks(role: Profile["role"]): PortalLink[] {
  const shared: PortalLink[] = [
    { href: "/resources", label: "Resources", icon: "resources", group: "Operations" },
    { href: "/weekly-program", label: "Weekly Program", icon: "weekly", group: "Operations" },
    { href: "/attendance", label: "Attendance", icon: "attendance", group: "Operations" },
  ];
  if (role === "super_admin") return [
    { href: "/admin", label: "Dashboard", icon: "dashboard", group: "Overview" },
    { href: "/admin/students", label: "Students", icon: "students", group: "People" },
    { href: "/admin/administrators", label: "Mentors", icon: "mentors", group: "People" },
    ...shared,
    { href: "/admin/gita-attendance", label: "Gita Attendance", icon: "attendance", group: "Operations" },
    { href: "/admin/leaves", label: "Home Leave", icon: "leave", group: "Operations" },
    { href: "/admin/payments", label: "Payments", icon: "reports", group: "Operations" },
    { href: "/admin/reports", label: "Reports", icon: "reports", group: "Insights" },
    { href: "/admin/daily-tracking", label: "Daily Tracking", icon: "reports", group: "Insights" },
    { href: "/admin/profile", label: "Profile Settings", icon: "settings", group: "System" },
    { href: "/admin/settings", label: "Settings", icon: "settings", group: "System" },
  ];
  if (role === "admin") return [
    { href: "/mentor", label: "Dashboard", icon: "dashboard", group: "Overview" },
    { href: "/mentor/students", label: "My Students", icon: "students", group: "People" },
    ...shared,
    { href: "/mentor/gita-attendance", label: "Gita Attendance", icon: "attendance", group: "Operations" },
    { href: "/mentor/leaves", label: "Home Leave", icon: "leave", group: "Operations" },
    { href: "/mentor/payments", label: "Payments", icon: "reports", group: "Operations" },
    { href: "/mentor/reports", label: "Reports", icon: "reports", group: "Insights" },
    { href: "/mentor/daily-tracking", label: "Daily Tracking", icon: "reports", group: "Insights" },
  ];
  return [
    { href: "/student", label: "Dashboard", icon: "dashboard", group: "Overview" },
    { href: "/student/entry", label: "Daily Entry", icon: "entry", group: "Overview" },
    { href: "/student/leave", label: "Home Leave", icon: "leave", group: "Operations" },
    { href: "/student/payments", label: "Payments", icon: "reports", group: "Operations" },
    { href: "/student/progress", label: "My Progress", icon: "reports", group: "Insights" },
    { href: "/student/settings", label: "Profile Settings", icon: "settings", group: "System" },
    ...shared,
  ];
}
