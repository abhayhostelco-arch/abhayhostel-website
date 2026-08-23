import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { RoleBadge } from "@/components/role-badge";
import type { Profile } from "@/lib/types";
import { MobilePortalNavigation, PortalNavigation, type PortalLink } from "@/components/portal-navigation";

export function PortalShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const shared: PortalLink[] = [
    { href: "/resources", label: "Resources", icon: "resources", group: "Operations" },
    { href: "/weekly-program", label: "Weekly Program", icon: "weekly", group: "Operations" },
    { href: "/attendance", label: "Attendance", icon: "attendance", group: "Operations" },
  ];
  const links: PortalLink[] = profile.role === "super_admin"
    ? [
        { href: "/admin", label: "Dashboard", icon: "dashboard", group: "Overview" },
        { href: "/admin/students", label: "Students", icon: "students", group: "People" },
        { href: "/admin/administrators", label: "Mentors", icon: "mentors", group: "People" },
        ...shared,
        { href: "/admin/alerts", label: "Alerts", icon: "alerts", group: "Insights" },
        { href: "/admin/reports", label: "Reports", icon: "reports", group: "Insights" },
        { href: "/admin/settings", label: "Settings", icon: "settings", group: "System" },
      ]
    : profile.role === "admin"
      ? [
          { href: "/mentor", label: "Dashboard", icon: "dashboard", group: "Overview" },
          { href: "/mentor/students", label: "My Students", icon: "students", group: "People" },
          ...shared,
          { href: "/mentor/alerts", label: "Alerts", icon: "alerts", group: "Insights" },
          { href: "/mentor/reports", label: "Reports", icon: "reports", group: "Insights" },
        ]
      : [
          { href: "/student", label: "Dashboard", icon: "dashboard", group: "Overview" },
          { href: "/student/entry", label: "Daily Entry", icon: "entry", group: "Overview" },
          { href: "/student/progress", label: "My Progress", icon: "reports", group: "Insights" },
          ...shared,
        ];

  return <div className="portal-shell">
    <a className="skip-link" href="#main-content">Skip to Main Content</a>
    <aside className="sidebar">
      <Link className="sidebar-brand" href="/" aria-label="Portal home"><Brand /></Link>
      <PortalNavigation links={links} />
      <div className="sidebar-identity"><span className="avatar" aria-hidden="true">{profile.full_name.slice(0, 1).toUpperCase()}</span><div><strong title={profile.full_name}>{profile.full_name}</strong><RoleBadge role={profile.role} /></div></div>
    </aside>
    <div className="portal-main">
      <header className="portal-topbar">
        <div className="mobile-brand"><Brand /></div>
        <div className="topbar-context"><span>Abhay Hostel</span><strong>Operations Portal</strong></div>
        <details className="account-menu"><summary><span className="avatar" aria-hidden="true">{profile.full_name.slice(0, 1).toUpperCase()}</span><span className="account-menu-copy"><strong>{profile.full_name}</strong><small>Account</small></span></summary><div className="account-menu-popover"><div><strong>{profile.full_name}</strong><RoleBadge role={profile.role} /></div><form action={logoutAction}><button type="submit"><LogOut size={16} aria-hidden="true" /> Sign Out</button></form></div></details>
      </header>
      <div id="main-content" tabIndex={-1}>{children}</div>
      <MobilePortalNavigation links={links} profile={profile} />
    </div>
  </div>;
}
