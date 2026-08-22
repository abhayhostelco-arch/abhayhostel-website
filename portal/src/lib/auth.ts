import "server-only";
import { redirect } from "next/navigation";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!hasPublicSupabaseEnv()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data || !data.is_active) return null;
    return data as Profile;
  } catch {
    return null;
  }
}

export async function requireProfile(roles?: AppRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  if (roles && !roles.includes(profile.role)) {
    redirect(profile.role === "student" ? "/student" : "/admin");
  }
  return profile;
}
