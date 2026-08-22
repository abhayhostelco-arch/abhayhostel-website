"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, BookOpen, CalendarCheck, ChartNoAxesCombined, ClipboardCheck, LayoutDashboard, Settings, ShieldCheck, Users } from "lucide-react";

const icons = { dashboard: LayoutDashboard, students: Users, mentors: ShieldCheck, alerts: BellRing, reports: ChartNoAxesCombined, entry: ClipboardCheck, resources: BookOpen, weekly: CalendarCheck, attendance: CalendarCheck, settings: Settings };
export type PortalLink = { href: string; label: string; icon: keyof typeof icons };

export function PortalNavigation({ links, mobile = false }: { links: PortalLink[]; mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={mobile ? "mobile-nav" : "side-nav"} aria-label={mobile ? "Mobile portal navigation" : "Portal navigation"}>
      {links.map(({ href, label, icon }) => {
        const Icon = icons[icon];
        const active = pathname === href || (href !== "/student" && href !== "/admin" && href !== "/mentor" && pathname.startsWith(`${href}/`));
        return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>;
      })}
    </nav>
  );
}
