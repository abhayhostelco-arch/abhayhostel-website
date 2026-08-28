import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
import { RoleBadge } from "@/components/role-badge";
import type { Profile } from "@/lib/types";
import { MobilePortalNavigation, PortalNavigation, type PortalLink } from "@/components/portal-navigation";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getAvatarSignedUrl } from "@/lib/data";

export async function PortalShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const avatarUrl = await getAvatarSignedUrl(profile.avatar_path);
  const firstName = profile.full_name.split(/\s+/).filter(Boolean)[0] ?? profile.full_name;
  const profileHref = profile.role === "student" ? "/student/settings" : profile.role === "admin" ? "/mentor/profile" : "/admin/profile";
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
        { href: "/admin/gita-attendance", label: "Gita Attendance", icon: "attendance", group: "Operations" },
        { href: "/admin/reports", label: "Reports", icon: "reports", group: "Insights" },
        { href: "/admin/settings", label: "Settings", icon: "settings", group: "System" },
      ]
    : profile.role === "admin"
      ? [
          { href: "/mentor", label: "Dashboard", icon: "dashboard", group: "Overview" },
          { href: "/mentor/students", label: "My Students", icon: "students", group: "People" },
          ...shared,
          { href: "/mentor/gita-attendance", label: "Gita Attendance", icon: "attendance", group: "Operations" },
          { href: "/mentor/reports", label: "Reports", icon: "reports", group: "Insights" },
        ]
      : [
          { href: "/student", label: "Dashboard", icon: "dashboard", group: "Overview" },
          { href: "/student/entry", label: "Daily Entry", icon: "entry", group: "Overview" },
          { href: "/student/progress", label: "My Progress", icon: "reports", group: "Insights" },
          { href: "/student/settings", label: "Profile Settings", icon: "settings", group: "System" },
          ...shared,
        ];

  return <div className="portal-shell">
    <a className="skip-link" href="#main-content">Skip to Main Content</a>
    <aside className="sidebar">
      <Link className="sidebar-brand" href="/" aria-label="Portal home"><Brand /></Link>
      <PortalNavigation links={links} />
      <aside className="sidebar-inspiration" aria-label="Today’s inspiration">
        <span>Today’s Inspiration</span>
        <blockquote>“Yoga is the journey of the self, through the self, to the self.”</blockquote>
        <small>Bhagavad Gita</small>
      </aside>
      <Link className="sidebar-identity" href={profileHref} aria-label="Open profile settings"><ProfileAvatar name={profile.full_name} src={avatarUrl} /><div><strong title={profile.full_name}>{profile.full_name}</strong><span className="sidebar-email" title={profile.email}>{profile.email}</span><RoleBadge role={profile.role} /></div></Link>
    </aside>
    <div className="portal-main">
      <header className="portal-topbar">
        <div className="mobile-brand"><Brand /></div>
        <div className="topbar-context"><strong>{profile.role === "super_admin" ? "Hare Krishna" : `Hare Krishna, ${firstName}`}</strong><span>{profile.role === "super_admin" ? "Administration Workspace" : profile.role === "admin" ? "Mentor Workspace" : "Student Workspace"}</span></div>
        <AccountMenu profile={profile} profileHref={profileHref} avatarUrl={avatarUrl} />
      </header>
      <div id="main-content" tabIndex={-1}>{children}</div>
      <MobilePortalNavigation links={links} profile={profile} />
    </div>
  </div>;
}
