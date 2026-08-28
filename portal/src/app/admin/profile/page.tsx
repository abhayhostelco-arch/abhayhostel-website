import type { Metadata } from "next";
import { StaffProfilePage } from "@/components/staff-profile-page";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile settings" };

export default async function AdminProfilePage() {
  const profile = await requireProfile(["super_admin"]);
  return <StaffProfilePage profile={profile} />;
}
