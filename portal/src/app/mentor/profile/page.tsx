import type { Metadata } from "next";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireProfile } from "@/lib/auth";
import { getAvatarSignedUrl, getProfileEnhancements } from "@/lib/data";
import { todayInIndia } from "@/lib/date";

export const metadata: Metadata = { title: "Profile settings" };

export default async function MentorProfilePage() {
  const profile = await requireProfile(["admin"]);
  const enhancements = await getProfileEnhancements(profile.id);
  const avatarUrl = enhancements.available ? await getAvatarSignedUrl(enhancements.avatarPath) : null;
  return <main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">Your account</p><h1>Profile Settings</h1><p>Update your profile picture and review your portal identity.</p></div></header>
    <section className="panel">
      {enhancements.available
        ? <ProfileSettingsForm profileId={profile.id} birthDate={null} avatarPath={enhancements.avatarPath} avatarUrl={avatarUrl} maxDate={todayInIndia()} showBirthDate={false} />
        : <div className="empty-state unavailable-state"><strong>Profile settings are temporarily unavailable</strong><p>Please try again later.</p></div>}
    </section>
  </main>;
}
