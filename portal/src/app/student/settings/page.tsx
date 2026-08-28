import type { Metadata } from "next";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireProfile } from "@/lib/auth";
import { getAvatarSignedUrl, getProfileEnhancements } from "@/lib/data";
import { todayInIndia } from "@/lib/date";

export const metadata: Metadata = { title: "Profile settings" };

export default async function StudentSettingsPage() {
  const profile = await requireProfile(["student"]);
  const enhancements = await getProfileEnhancements(profile.id);
  const avatarUrl = enhancements.available ? await getAvatarSignedUrl(enhancements.avatarPath) : null;
  return <main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">Your account</p><h1>Profile Settings</h1><p>Add the personal details that help your Mentor recognize and support you.</p></div></header>
    <section className="panel">
      {enhancements.available
        ? <ProfileSettingsForm profileId={profile.id} birthDate={enhancements.birthDate} avatarPath={enhancements.avatarPath} avatarUrl={avatarUrl} maxDate={todayInIndia()} />
        : <div className="empty-state unavailable-state"><strong>Profile settings are temporarily unavailable</strong><p>Please try again later.</p></div>}
    </section>
  </main>;
}
