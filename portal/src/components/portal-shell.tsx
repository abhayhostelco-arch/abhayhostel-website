import Link from "next/link";
import type { ReactNode } from "react";
import {
  BellRing,
  ChartNoAxesCombined,
  ClipboardCheck,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { RoleBadge } from "@/components/role-badge";
import type { Profile } from "@/lib/types";

export function PortalShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const isAdmin = profile.role !== "student";
  const links = isAdmin
    ? [
        { href: "/admin", label: "Overview", icon: ChartNoAxesCombined },
        { href: "/admin/students", label: "Students", icon: Users },
        { href: "/admin/alerts", label: "Alerts", icon: BellRing },
        { href: "/admin/reports", label: "Reports", icon: ClipboardCheck },
        ...(profile.role === "super_admin"
          ? [
              { href: "/admin/administrators", label: "Administrators", icon: ShieldCheck },
              { href: "/admin/settings", label: "Settings", icon: Settings },
            ]
          : []),
      ]
    : [{ href: "/student", label: "Daily tracker", icon: ClipboardCheck }];

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <Link href="/" aria-label="Portal home">
          <Brand />
        </Link>
        <nav className="side-nav" aria-label="Portal navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
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
          <RoleBadge role={profile.role} />
        </header>
        <nav className="mobile-nav" aria-label="Mobile portal navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Icon size={16} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
