"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RoleBadge } from "@/components/role-badge";
import { ThemeControl } from "@/components/theme-control";
import type { Profile } from "@/lib/types";
import { roleLabels } from "@/lib/roles";

export function AccountMenu({ profile, profileHref, avatarUrl }: { profile: Profile; profileHref: string; avatarUrl: string | null }) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMenu(restoreFocus = false) {
    const details = detailsRef.current;
    if (!details?.open) return;
    details.open = false;
    if (restoreFocus) details.querySelector<HTMLElement>("summary")?.focus();
  }

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) closeMenu();
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        event.preventDefault();
        closeMenu(true);
      }
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  return <details ref={detailsRef} className="account-menu"><summary><ProfileAvatar name={profile.full_name} src={avatarUrl} /><span className="account-menu-copy"><strong>{profile.full_name}</strong><small>{roleLabels[profile.role]}</small></span><ChevronDown className="account-menu-chevron" size={16} aria-hidden="true" /></summary><div className="account-menu-popover"><Link className="account-profile-link" href={profileHref} aria-label="Open profile settings" onClick={() => closeMenu()}><strong>{profile.full_name}</strong><span className="account-menu-email">{profile.email}</span><RoleBadge role={profile.role} /><small>Open Profile Settings →</small></Link><ThemeControl /><form action={logoutAction}><button type="submit"><LogOut size={16} aria-hidden="true" /> Sign Out</button></form></div></details>;
}
