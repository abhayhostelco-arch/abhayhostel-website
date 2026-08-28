"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, CalendarCheck, ChartNoAxesCombined, ClipboardCheck, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { RoleBadge } from "@/components/role-badge";
import type { Profile } from "@/lib/types";

const icons = { dashboard: LayoutDashboard, students: Users, mentors: ShieldCheck, reports: ChartNoAxesCombined, entry: ClipboardCheck, resources: BookOpen, weekly: CalendarCheck, attendance: CalendarCheck, settings: Settings };
export type PortalLink = { href: string; label: string; icon: keyof typeof icons; group: "Overview" | "People" | "Operations" | "Insights" | "System" };

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/student" && href !== "/admin" && href !== "/mentor" && pathname.startsWith(`${href}/`));
}

function NavigationLink({ link, pathname, onNavigate }: { link: PortalLink; pathname: string; onNavigate?: () => void }) {
  const Icon = icons[link.icon];
  const active = isActive(pathname, link.href);
  return <Link href={link.href} aria-current={active ? "page" : undefined} onClick={onNavigate}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{link.label}</span></Link>;
}

export function PortalNavigation({ links }: { links: PortalLink[] }) {
  const pathname = usePathname();
  const groups = [...new Set(links.map((link) => link.group))];
  return <nav className="side-nav" aria-label="Portal navigation">{groups.map((group) => <section className="nav-group" key={group} aria-labelledby={`nav-${group.toLowerCase()}`}><p id={`nav-${group.toLowerCase()}`} className="nav-group-label">{group}</p><div className="nav-group-links">{links.filter((link) => link.group === group).map((link) => <NavigationLink key={link.href} link={link} pathname={pathname} />)}</div></section>)}</nav>;
}

export function MobilePortalNavigation({ links, profile }: { links: PortalLink[]; profile: Profile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const profileHref = profile.role === "student" ? "/student/settings" : profile.role === "admin" ? "/mentor/profile" : "/admin/profile";
  const pinned = links.slice(0, 3);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const opener = openButtonRef.current;
    const focusable = () => [...(sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    const first = focusable()[0];
    document.body.style.overflow = "hidden";
    first?.focus();
    const manageKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", manageKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", manageKeyboard);
      opener?.focus();
    };
  }, [open]);
  return <><nav className="mobile-nav" aria-label="Primary mobile navigation">{pinned.map((link) => <NavigationLink key={link.href} link={link} pathname={pathname} />)}<button ref={openButtonRef} type="button" aria-label="Open all navigation" aria-expanded={open} aria-controls={sheetId} onClick={() => setOpen(true)}><Menu size={18} aria-hidden="true" /><span>More</span></button></nav>{open ? <div className="mobile-sheet-backdrop" onMouseDown={() => setOpen(false)}><section ref={sheetRef} id={sheetId} className="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title" onMouseDown={(event) => event.stopPropagation()}><header><Link className="mobile-profile-link" href={profileHref} onClick={() => setOpen(false)}><p className="nav-group-label">Signed In As</p><h2 id="mobile-menu-title">{profile.full_name}</h2><p className="mobile-sheet-email">{profile.email}</p><small>Open Profile Settings →</small></Link><button className="icon-button" type="button" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button></header><RoleBadge role={profile.role} /><nav className="mobile-sheet-links" aria-label="All portal navigation">{links.map((link) => <NavigationLink key={link.href} link={link} pathname={pathname} onNavigate={() => setOpen(false)} />)}</nav><form action={logoutAction}><button className="button button-secondary mobile-signout" type="submit"><LogOut size={17} aria-hidden="true" /> Sign Out</button></form></section></div> : null}</>;
}
