import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RoleBadge } from "@/components/role-badge";
import type { Profile } from "@/lib/types";

export function StaffProfilePage({ profile }: { profile: Profile }) {
  return <main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">Your account</p><h1>Profile Settings</h1><p>Review your portal identity and account security.</p></div></header>
    <section className="panel staff-profile-card">
      <ProfileAvatar name={profile.full_name} size={84} className="profile-heading-avatar" />
      <div className="staff-profile-copy"><h2>{profile.full_name}</h2><RoleBadge role={profile.role} /><p><Mail size={16} aria-hidden="true" /> {profile.email}</p></div>
      <Link className="button button-secondary" href="/change-password"><KeyRound size={17} aria-hidden="true" /> Change password</Link>
    </section>
  </main>;
}
