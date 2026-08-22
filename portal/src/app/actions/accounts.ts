"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateTemporaryPassword, hasRecentReauth, markRecentReauth } from "@/lib/security";
import type { ActionState, AppRole, Profile } from "@/lib/types";
import {
  createAccountSchema,
  flattenErrors,
  reauthenticateSchema,
  resetAccountSchema,
  targetAccountSchema,
} from "@/lib/validation";

async function audit(
  actorId: string,
  action: string,
  targetId: string | null,
  metadata: Record<string, string | boolean> = {},
) {
  const admin = createAdminClient();
  await admin.from("audit_events").insert({
    actor_id: actorId,
    action,
    target_id: targetId,
    metadata,
  });
}

async function getTarget(targetId: string): Promise<Profile | null> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .maybeSingle();
  return data as Profile | null;
}

function canManage(actorRole: AppRole, target: Profile): boolean {
  if (target.role === "super_admin") return false;
  if (actorRole === "super_admin") return true;
  return actorRole === "admin" && target.role === "student";
}

export async function createAccountAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const parsed = createAccountSchema.safeParse({
    role: formData.get("role"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    academyLabel: formData.get("academyLabel") ?? "",
    joinedOn: formData.get("joinedOn") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  }
  if (parsed.data.role === "admin" && actor.role !== "super_admin") {
    return { status: "error", message: "You are not permitted to create an administrator." };
  }
  if (parsed.data.role === "admin" && !(await hasRecentReauth(actor.id))) {
    return { status: "error", message: "Re-enter your password before creating an administrator." };
  }

  const password = generateTemporaryPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    app_metadata: { role: parsed.data.role, created_by: actor.id },
    user_metadata: {
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      academy_label: parsed.data.role === "student" ? parsed.data.academyLabel : null,
      joined_on: parsed.data.role === "student" ? parsed.data.joinedOn : null,
    },
  });
  if (error || !data.user) {
    return { status: "error", message: "The account could not be created." };
  }

  // Supabase may insert auth.users before applying app_metadata. Set the
  // authoritative profile explicitly so an Admin can never inherit the
  // trigger's deny-safe student default.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: parsed.data.role,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      academy_label: parsed.data.role === "student" ? parsed.data.academyLabel : null,
      joined_on: parsed.data.role === "student" ? parsed.data.joinedOn : null,
      created_by: actor.id,
      is_active: true,
      must_change_password: true,
    })
    .eq("id", data.user.id);
  if (profileError) {
    await admin.auth.admin.updateUserById(data.user.id, { ban_duration: "876000h" });
    return { status: "error", message: "The account could not be initialized." };
  }

  await audit(actor.id, "account_created", data.user.id, { role: parsed.data.role });
  revalidatePath("/admin/students");
  revalidatePath("/admin/administrators");
  return {
    status: "success",
    message: "Account created. Copy the temporary password now; it will not be shown again.",
    temporaryPassword: password,
  };
}

export async function setAccountActiveAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const parsed = targetAccountSchema.safeParse({
    targetId: formData.get("targetId"),
    active: formData.get("active"),
  });
  if (!parsed.success || parsed.data.targetId === actor.id) return;
  const target = await getTarget(parsed.data.targetId);
  if (!target || !canManage(actor.role, target)) return;
  if (target.role === "admin" && !(await hasRecentReauth(actor.id))) return;

  const admin = createAdminClient();
  if (parsed.data.active) {
    const { error: authError } = await admin.auth.admin.updateUserById(target.id, {
      ban_duration: "none",
    });
    if (authError) return;
    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: true })
      .eq("id", target.id)
      .neq("role", "super_admin");
    if (profileError) return;
  } else {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", target.id)
      .neq("role", "super_admin");
    if (profileError) return;
    const { error: authError } = await admin.auth.admin.updateUserById(target.id, {
      ban_duration: "876000h",
    });
    if (authError) return;
  }
  await audit(
    actor.id,
    parsed.data.active ? "account_reactivated" : "account_deactivated",
    target.id,
    { role: target.role },
  );
  revalidatePath("/admin/students");
  revalidatePath("/admin/administrators");
}

export async function resetAccountPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const parsed = resetAccountSchema.safeParse({ targetId: formData.get("targetId") });
  if (!parsed.success) return { status: "error", message: "Invalid account." };
  const target = await getTarget(parsed.data.targetId);
  if (!target || !canManage(actor.role, target)) {
    return { status: "error", message: "The account cannot be reset." };
  }
  if (!(await hasRecentReauth(actor.id))) {
    return {
      status: "error",
      message: "Unlock credential resets on this page, then select Reset again.",
    };
  }

  const password = generateTemporaryPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(target.id, { password });
  if (error) return { status: "error", message: "The account could not be reset." };
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", target.id);
  await audit(actor.id, "credential_reset", target.id, { role: target.role });
  return {
    status: "success",
    message: "Credentials reset. Copy the temporary password now.",
    temporaryPassword: password,
  };
}

export async function reauthenticateAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const parsed = reauthenticateSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: "Password verification failed." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: actor.email,
    password: parsed.data.password,
  });
  if (error) return { status: "error", message: "Password verification failed." };
  await markRecentReauth(actor.id);
  return { status: "success", message: "Sensitive actions are unlocked for 15 minutes." };
}
