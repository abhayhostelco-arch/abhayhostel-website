import type { Metadata } from "next";
import { StaffProfilePage } from "@/components/staff-profile-page";
import { requireProfile } from "@/lib/auth";
import { AdminCleanupPanel } from "@/components/admin-cleanup-panel";
import { AutoCleanupTrigger } from "@/components/auto-cleanup-trigger";
import { loadCleanupAdminData } from "@/lib/cleanup/repository";
import { isMissingCleanupSchemaError } from "@/lib/schema-compat";

export const metadata: Metadata = { title: "Profile settings" };

export default async function AdminProfilePage() {
  const profile = await requireProfile(["super_admin"]);
  let maintenance = { available: false, settings: null, runs: [] } as Awaited<ReturnType<typeof loadCleanupAdminData>>;
  try {
    maintenance = await loadCleanupAdminData();
  } catch (error) {
    if (!isMissingCleanupSchemaError(error as { code?: string; message?: string; details?: string })) throw error;
  }
  return <><AutoCleanupTrigger /><StaffProfilePage profile={profile} /><div className="page-container cleanup-page-section"><AdminCleanupPanel {...maintenance} /></div></>;
}
