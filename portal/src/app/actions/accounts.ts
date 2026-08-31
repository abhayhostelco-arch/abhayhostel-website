"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { todayInIndia } from "@/lib/date";
import { isMissingSchemaError } from "@/lib/schema-compat";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword } from "@/lib/security";
import { studentGroupLabel } from "@/lib/student-groups";
import type { ActionState, Profile, StudentGroup } from "@/lib/types";
import {
  createAccountSchema,
  assignMentorSchema,
  flattenErrors,
  optionalBirthDateSchema,
  resetAccountSchema,
  studentGroupActionSchema,
  targetAccountSchema,
} from "@/lib/validation";

const studentGroupMigrationMessage = "Student groups are unavailable until the student group migration is applied.";

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

function canManage(actor: Profile, target: Profile): boolean {
  if (target.role === "super_admin") return false;
  if (actor.role === "super_admin") return true;
  return actor.role === "admin" && target.role === "student" && target.mentor_id === actor.id;
}

async function studentGroupColumnAvailable(): Promise<boolean> {
  const { error } = await createAdminClient().from("profiles").select("student_group").limit(1);
  return !isMissingSchemaError(error);
}

async function updateStudentGroup(actorId: string, studentId: string, studentGroup: StudentGroup) {
  return createAdminClient().rpc("update_student_group", {
    p_actor_uuid: actorId,
    p_student_uuid: studentId,
    p_student_group: studentGroup,
  });
}

export async function createAccountAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = createAccountSchema.safeParse({
    role: formData.get("role"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    academyLabel: formData.get("academyLabel") ?? "",
    joinedOn: formData.get("joinedOn") || undefined,
    mentorId: formData.get("mentorId") || undefined,
    studentGroup: formData.get("studentGroup") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  }
  if (parsed.data.role === "student" && !parsed.data.mentorId) {
    return { status: "error", message: "Choose a Mentor for the new student." };
  }
  if (parsed.data.role === "student" && !await studentGroupColumnAvailable()) {
    return { status: "error", message: studentGroupMigrationMessage };
  }
  if (parsed.data.mentorId) {
    const mentor = await getTarget(parsed.data.mentorId);
    if (!mentor || mentor.role !== "admin" || !mentor.is_active) return { status: "error", message: "Choose an active Mentor." };
  }

  const password = generateTemporaryPassword();
  const admin = createAdminClient();
  const authMetadata = {
    app_metadata: { role: parsed.data.role, created_by: actor.id },
    user_metadata: {
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      academy_label: parsed.data.role === "student" ? parsed.data.academyLabel : null,
      joined_on: parsed.data.role === "student" ? parsed.data.joinedOn : null,
      mentor_id: parsed.data.role === "student" ? parsed.data.mentorId : null,
      student_group: parsed.data.role === "student" ? parsed.data.studentGroup : null,
    },
  };
  const profileValues = {
    role: parsed.data.role,
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    academy_label: parsed.data.role === "student" ? parsed.data.academyLabel : null,
    joined_on: parsed.data.role === "student" ? parsed.data.joinedOn : null,
    mentor_id: parsed.data.role === "student" ? parsed.data.mentorId : null,
    created_by: actor.id,
    is_active: true,
    must_change_password: true,
  };
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existingProfile) {
    const existing = existingProfile as Profile;
    if (existing.is_active) {
      return {
        status: "error",
        message: `A second account cannot use this email. It already belongs to an active ${existing.role === "admin" ? "Mentor" : "Student"} account.`,
      };
    }
    if (existing.role !== parsed.data.role) {
      return {
        status: "error",
        message: `This email belongs to an inactive ${existing.role === "admin" ? "Mentor" : "Student"} account. Reactivate it from the correct directory.`,
      };
    }
    if (parsed.data.role === "student" && !existing.student_group) {
      return { status: "error", message: studentGroupMigrationMessage };
    }
    const { error: authError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      ban_duration: "none",
      email_confirm: true,
      ...authMetadata,
    });
    if (authError) {
      return { status: "error", message: "The account exists, but its login could not be reactivated. Try Reactivate from the account directory." };
    }
    const oldGroup = existing.student_group;
    if (parsed.data.role === "student") {
      const { error: groupError } = await updateStudentGroup(actor.id, existing.id, parsed.data.studentGroup);
      if (groupError) {
        await admin.auth.admin.updateUserById(existing.id, { ban_duration: "876000h" });
        return { status: "error", message: isMissingSchemaError(groupError) ? studentGroupMigrationMessage : "The Student group could not be saved. The account remains inactive." };
      }
    }
    const { error: profileError } = await admin
      .from("profiles")
      .update(profileValues)
      .eq("id", existing.id)
      .eq("is_active", false);
    if (profileError) {
      await admin.auth.admin.updateUserById(existing.id, { ban_duration: "876000h" });
      return { status: "error", message: "The login was restored, but its portal profile could not be updated. The account remains inactive." };
    }
    await audit(actor.id, "account_reactivated", existing.id, {
      role: parsed.data.role,
      restored_during_creation: true,
      ...(parsed.data.role === "student" && oldGroup ? { old_group: oldGroup, new_group: parsed.data.studentGroup } : {}),
    });
    revalidatePath("/admin/students");
    revalidatePath("/admin/administrators");
    return {
      status: "success",
      message: "Existing inactive account restored. Copy the new temporary password now.",
      temporaryPassword: password,
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    ...authMetadata,
  });
  if (error || !data.user) {
    const duplicateEmail = error?.code === "email_exists"
      || error?.code === "user_already_exists"
      || /already (?:been )?(?:registered|exists)|already uses/i.test(error?.message ?? "");
    return {
      status: "error",
      message: duplicateEmail
        ? "A second account cannot use this email. It is already registered in authentication, but no matching portal profile was found. Restore the existing identity or use a different email."
        : "The authentication service rejected account creation. Check the submitted details and try again.",
    };
  }

  // Supabase may insert auth.users before applying app_metadata. Set the
  // authoritative profile explicitly so an Admin can never inherit the
  // trigger's deny-safe student default.
  const { error: profileError } = await admin
    .from("profiles")
    .update(profileValues)
    .eq("id", data.user.id);
  if (profileError) {
    await admin.auth.admin.updateUserById(data.user.id, { ban_duration: "876000h" });
    return { status: "error", message: "The account could not be initialized." };
  }

  if (parsed.data.role === "student") {
    const { error: groupError } = await updateStudentGroup(actor.id, data.user.id, parsed.data.studentGroup);
    if (groupError) {
      await admin.from("profiles").update({ is_active: false }).eq("id", data.user.id);
      await admin.auth.admin.updateUserById(data.user.id, { ban_duration: "876000h" });
      return { status: "error", message: isMissingSchemaError(groupError) ? studentGroupMigrationMessage : "The Student group could not be initialized." };
    }
  }

  await audit(actor.id, "account_created", data.user.id, {
    role: parsed.data.role,
    ...(parsed.data.role === "student" ? { student_group: parsed.data.studentGroup } : {}),
  });
  revalidatePath("/admin/students");
  revalidatePath("/admin/administrators");
  return {
    status: "success",
    message: "Account created. Copy the temporary password now; it will not be shown again.",
    temporaryPassword: password,
  };
}

export async function updateStudentGroupAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = studentGroupActionSchema.safeParse({
    targetId: formData.get("targetId"),
    studentGroup: formData.get("studentGroup"),
  });
  if (!parsed.success) return { status: "error", message: "Choose a valid Student group." };
  const target = await getTarget(parsed.data.targetId);
  if (!target || target.role !== "student") return { status: "error", message: "This Student cannot be updated." };

  const { error } = await updateStudentGroup(actor.id, target.id, parsed.data.studentGroup);
  if (isMissingSchemaError(error)) return { status: "error", message: studentGroupMigrationMessage };
  if (error) return { status: "error", message: "The Student group could not be saved." };
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${target.id}`);
  revalidatePath(`/mentor/students/${target.id}`);
  return { status: "success", message: "Student group saved." };
}

export async function reactivateStudentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const parsed = studentGroupActionSchema.safeParse({
    targetId: formData.get("targetId"),
    studentGroup: formData.get("studentGroup"),
  });
  if (!parsed.success) return { status: "error", message: "Choose a valid Student group." };
  const target = await getTarget(parsed.data.targetId);
  if (!target || target.role !== "student" || target.is_active || !canManage(actor, target)) {
    return { status: "error", message: "This Student cannot be reactivated." };
  }
  if (!await studentGroupColumnAvailable() || !target.student_group) {
    return { status: "error", message: studentGroupMigrationMessage };
  }
  if (actor.role !== "super_admin" && target.student_group !== parsed.data.studentGroup) {
    return { status: "error", message: "Only a Super Admin can change a Student group." };
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(target.id, { ban_duration: "none" });
  if (authError) return { status: "error", message: "The Student login could not be reactivated." };
  if (actor.role === "super_admin") {
    const { error: groupError } = await updateStudentGroup(actor.id, target.id, parsed.data.studentGroup);
    if (groupError) {
      await admin.auth.admin.updateUserById(target.id, { ban_duration: "876000h" });
      return { status: "error", message: isMissingSchemaError(groupError) ? studentGroupMigrationMessage : "The Student group could not be saved. The account remains inactive." };
    }
  }
  const { error: profileError } = await admin.from("profiles").update({ is_active: true }).eq("id", target.id).eq("role", "student");
  if (profileError) {
    await admin.auth.admin.updateUserById(target.id, { ban_duration: "876000h" });
    return { status: "error", message: "The Student profile could not be reactivated." };
  }
  await audit(actor.id, "account_reactivated", target.id, {
    role: "student",
    old_group: target.student_group,
    new_group: parsed.data.studentGroup,
  });
  revalidatePath("/admin/students");
  revalidatePath("/mentor/students");
  return { status: "success", message: `Student reactivated in ${studentGroupLabel(parsed.data.studentGroup)}.` };
}

export async function setAccountActiveAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const parsed = targetAccountSchema.safeParse({
    targetId: formData.get("targetId"),
    active: formData.get("active"),
  });
  if (!parsed.success || parsed.data.targetId === actor.id) return;
  const target = await getTarget(parsed.data.targetId);
  if (!target || !canManage(actor, target)) return;
  if (parsed.data.active && target.role === "student") return;

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
  if (!target || !canManage(actor, target)) {
    return { status: "error", message: "The account cannot be reset." };
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

export async function updateStudentBirthDateAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const targetId = resetAccountSchema.safeParse({ targetId: formData.get("targetId") });
  const birthDate = optionalBirthDateSchema.safeParse(formData.get("birthDate") ?? "");
  if (!targetId.success || !birthDate.success) return { status: "error", message: "Choose a valid birthdate." };
  if (birthDate.data && birthDate.data > todayInIndia()) return { status: "error", message: "Birthdate cannot be in the future." };
  const target = await getTarget(targetId.data.targetId);
  if (!target || target.role !== "student" || !canManage(actor, target)) {
    return { status: "error", message: "This student cannot be updated." };
  }
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ birth_date: birthDate.data ?? null })
    .eq("id", target.id)
    .eq("role", "student");
  if (isMissingSchemaError(error)) return { status: "error", message: "Birthdate editing is unavailable until the profile migration is applied." };
  if (error) return { status: "error", message: "The birthdate could not be saved." };
  await audit(actor.id, "student_birthdate_updated", target.id, { birthdate_set: Boolean(birthDate.data) });
  revalidatePath(`/admin/students/${target.id}`);
  return { status: "success", message: "Birthdate saved." };
}

export async function assignStudentMentorAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = assignMentorSchema.safeParse({ studentId: formData.get("studentId"), mentorId: formData.get("mentorId") });
  if (!parsed.success) return;
  const [student, mentor] = await Promise.all([getTarget(parsed.data.studentId), getTarget(parsed.data.mentorId)]);
  if (!student || student.role !== "student" || !mentor || mentor.role !== "admin" || !mentor.is_active) return;
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ mentor_id: mentor.id }).eq("id", student.id).eq("role", "student");
  if (error) return;
  await audit(actor.id, "mentor_assigned", student.id, { mentor_id: mentor.id });
  revalidatePath("/admin");
  revalidatePath("/admin/students");
  revalidatePath("/mentor");
}
