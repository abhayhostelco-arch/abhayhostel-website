import Link from "next/link";
import type { ReactNode } from "react";
import {
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { RoleBadge } from "@/components/role-badge";
import type { Profile } from "@/lib/types";
import { PortalNavigation, type PortalLink } from "@/components/portal-navigation";

export function PortalShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const shared: PortalLink[] = [
    { href: "/resources", label: "Resources", icon: "resources" },
    { href: "/weekly-program", label: "Weekly Program", icon: "weekly" },
    { href: "/attendance", label: "Attendance", icon: "attendance" },
  ];
  const links: PortalLink[] = profile.role === "super_admin"
    ? [
        { href: "/admin", label: "Dashboard", icon: "dashboard" }, { href: "/admin/students", label: "Students", icon: "students" },
        { href: "/admin/administrators", label: "Mentors", icon: "mentors" }, { href: "/admin/alerts", label: "Alerts", icon: "alerts" },
        { href: "/admin/reports", label: "Reports", icon: "reports" }, ...shared, { href: "/admin/settings", label: "Settings", icon: "settings" },
      ]
    : profile.role === "admin"
      ? [
          { href: "/mentor", label: "Dashboard", icon: "dashboard" }, { href: "/mentor/students", label: "My Students", icon: "students" },
          { href: "/mentor/alerts", label: "Alerts", icon: "alerts" }, { href: "/mentor/reports", label: "Reports", icon: "reports" }, ...shared,
        ]
      : [
          { href: "/student", label: "Dashboard", icon: "dashboard" }, { href: "/student/entry", label: "Daily Entry", icon: "entry" },
          { href: "/student/progress", label: "My Progress", icon: "reports" }, ...shared,
        ];

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <Link href="/" aria-label="Portal home">
          <Brand />
        </Link>
        <PortalNavigation links={links} />
        <div className="sidebar-user">
          <strong>{profile.full_name}</strong>
          <RoleBadge role={profile.role} />
          <form action={logoutAction}>
            <button className="logout-link" type="submit">
              <LogOut size={16} aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="portal-main">
        <header className="mobile-header">
          <Brand />
          <div className="mobile-header-actions">
            <RoleBadge role={profile.role} />
            <form action={logoutAction}>
              <button className="mobile-logout" type="submit">
                <LogOut size={16} aria-hidden="true" /> Sign out
              </button>
            </form>
          </div>
        </header>
        <PortalNavigation links={links} mobile />
        {children}
      </div>
    </div>
  );
}
