import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
import type { Profile } from "@/lib/types";
import { MobilePortalNavigation, PortalNavigation } from "@/components/portal-navigation";
import { getPortalLinks } from "@/components/portal-links";
import { getAvatarSignedUrl } from "@/lib/data";

export async function PortalShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const avatarUrl = await getAvatarSignedUrl(profile.avatar_path);
  const firstName = profile.full_name.split(/\s+/).filter(Boolean)[0] ?? profile.full_name;
  const profileHref = profile.role === "student" ? "/student/settings" : profile.role === "admin" ? "/mentor/profile" : "/admin/profile";
  const links = getPortalLinks(profile.role);

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
