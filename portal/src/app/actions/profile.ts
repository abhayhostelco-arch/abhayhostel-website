"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/schema-compat";
import type { ActionState } from "@/lib/types";
import { avatarPathSchema, optionalBirthDateSchema } from "@/lib/validation";
import { todayInIndia } from "@/lib/date";

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile(["student", "admin"]);
  const birthDate = profile.role === "student"
    ? optionalBirthDateSchema.safeParse(formData.get("birthDate") ?? "")
    : { success: true as const, data: profile.birth_date ?? null };
  const avatarValue = formData.get("avatarPath");
  const avatarPath = avatarValue === "" || avatarValue === null
    ? { success: true as const, data: null }
    : avatarPathSchema.safeParse(avatarValue);
  if (!birthDate.success || !avatarPath.success) {
    return { status: "error", message: "Review the birthdate and profile picture." };
  }
  if (birthDate.data && birthDate.data > todayInIndia()) {
    return { status: "error", message: "Birthdate cannot be in the future." };
  }
  if (avatarPath.data && !avatarPath.data.startsWith(`${profile.id}/`)) {
    return { status: "error", message: "The profile picture path is not owned by this account." };
  }
  const profileUpdate = profile.role === "student"
    ? (await createClient()).from("profiles").update({ birth_date: birthDate.data ?? null, avatar_path: avatarPath.data }).eq("id", profile.id)
    : createAdminClient().from("profiles").update({ avatar_path: avatarPath.data }).eq("id", profile.id).eq("role", "admin");
  const { error } = await profileUpdate;
  if (isMissingSchemaError(error)) {
    return { status: "error", message: "Profile enhancements are unavailable until the new migration is applied." };
  }
  if (error) return { status: "error", message: "Profile settings could not be saved." };
  await createAdminClient().from("audit_events").insert({
    actor_id: profile.id,
    action: "settings_updated",
    target_id: profile.id,
    metadata: { setting_type: "profile", avatar_updated: avatarPath.data !== (profile.avatar_path ?? null) },
  });
  revalidatePath(profile.role === "student" ? "/student/settings" : "/mentor/profile");
  revalidatePath(profile.role === "student" ? "/student" : "/mentor");
  return { status: "success", message: "Profile settings saved." };
}
