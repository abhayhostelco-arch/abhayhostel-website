"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isWithinEntryWindow, isWithinStudentEntryWindow } from "@/lib/date";
import { sleepDurationMinutes } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";
import { dailyEntrySchema, flattenErrors, mahaMantraPathSchema, mahaMantraUploadRequestSchema, staffDailyEntrySchema } from "@/lib/validation";
import { isMissingSchemaError } from "@/lib/schema-compat";

const evidenceExtensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export type DailyEntryEvidenceUploadGrant =
  | { status: "success"; path: string; token: string }
  | { status: "error"; message: string };

async function canManageDailyEntryEvidence(profile: { id: string; role: string }, studentId: string) {
  if (profile.role === "student") return profile.id === studentId;
  if (profile.role === "super_admin") return true;
  const { data } = await createAdminClient().from("profiles")
    .select("id").eq("id", studentId).eq("role", "student").eq("is_active", true).eq("mentor_id", profile.id).maybeSingle();
  return Boolean(data);
}

export async function createDailyEntryEvidenceUploadAction(input: unknown): Promise<DailyEntryEvidenceUploadGrant> {
  const profile = await requireProfile(["super_admin", "admin", "student"]);
  const parsed = mahaMantraUploadRequestSchema.safeParse(input);
  if (!parsed.success || !await canManageDailyEntryEvidence(profile, parsed.success ? parsed.data.studentId : "")) {
    return { status: "error", message: "The portal is not authorized to upload this image. Your form data is preserved; contact the administrator." };
  }
  const path = `${parsed.data.studentId}/${parsed.data.entryDate}/maha-mantra-${Date.now()}.${evidenceExtensions[parsed.data.type]}`;
  const { data, error } = await createAdminClient().storage.from("maha-mantra-evidence").createSignedUploadUrl(path);
  if (error) return { status: "error", message: "Maha Mantra image storage is currently unavailable. Your form data is preserved; try again later." };
  return { status: "success", path, token: data.token };
}

export async function removeDailyEntryEvidenceAction(input: unknown): Promise<boolean> {
  const parsed = mahaMantraUploadRequestSchema.pick({ studentId: true, entryDate: true }).extend({ path: mahaMantraPathSchema }).safeParse(input);
  if (!parsed.success) return false;
  const profile = await requireProfile(["super_admin", "admin", "student"]);
  if (!await canManageDailyEntryEvidence(profile, parsed.data.studentId) || !parsed.data.path.startsWith(`${parsed.data.studentId}/${parsed.data.entryDate}/`)) return false;
  const { error } = await createAdminClient().storage.from("maha-mantra-evidence").remove([parsed.data.path]);
  return !error;
}

export async function saveDailyEntryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile(["super_admin", "admin", "student"]);
  const entryInput = {
    entryDate: formData.get("entryDate"),
    sleepTime: formData.get("sleepTime"),
    wakeTime: formData.get("wakeTime"),
    studyHours: formData.get("studyHours"),
    studyMinutes: formData.get("studyMinutes"),
    chantingRounds: formData.get("chantingRounds"),
    gitaClassStatus: formData.get("gitaClassStatus"),
    morningAratiStatus: formData.get("morningAratiStatus"),
    mahaMantraPath: formData.get("mahaMantraPath") ?? "",
    eveningReadingMinutes: formData.get("eveningReadingMinutes"),
    libraryAttended: formData.get("libraryAttended") === "on",
    sevaMinutes: formData.get("sevaMinutes"),
    note: formData.get("note") ?? "",
  };
  const parsed = (profile.role === "student" ? dailyEntrySchema : staffDailyEntrySchema).safeParse(entryInput);
  if (!parsed.success) {
    return { status: "error", message: "The entry was not saved. Correct the highlighted fields and try again.", fieldErrors: flattenErrors(parsed.error) };
  }
  const targetStudentId = profile.role === "student" ? profile.id : String(formData.get("studentId") ?? "");
  if (!targetStudentId || !/^[0-9a-f-]{36}$/i.test(targetStudentId)) return { status: "error", message: "Choose a valid student." };
  if (parsed.data.mahaMantraPath && !parsed.data.mahaMantraPath.startsWith(`${targetStudentId}/${parsed.data.entryDate}/`)) {
    return { status: "error", message: "Choose evidence uploaded by this student." };
  }
  const validDate = profile.role === "student" ? isWithinStudentEntryWindow(parsed.data.entryDate) : isWithinEntryWindow(parsed.data.entryDate);
  if (!validDate) {
    return { status: "error", message: profile.role === "student" ? "Students can edit today or yesterday only." : "Choose a date within the last 90 days." };
  }

  const sleepMinutes = sleepDurationMinutes(parsed.data.sleepTime, parsed.data.wakeTime);
  if (sleepMinutes <= 0 || sleepMinutes > 960) {
    return { status: "error", message: "Sleep duration must be between 1 minute and 16 hours." };
  }
  const studyMinutes = parsed.data.studyHours * 60 + parsed.data.studyMinutes;
  if (studyMinutes > 1080) {
    return { status: "error", message: "Study duration cannot exceed 18 hours." };
  }

  const supabase = await createClient();
  const legacyPayload = {
      student_id: targetStudentId,
      entry_date: parsed.data.entryDate,
      sleep_time: parsed.data.sleepTime,
      wake_time: parsed.data.wakeTime,
      study_minutes: studyMinutes,
      chanting_rounds: parsed.data.chantingRounds,
      gita_class_status: parsed.data.gitaClassStatus,
      morning_arati_attended: parsed.data.morningAratiStatus === "present",
      evening_reading_minutes: parsed.data.eveningReadingMinutes,
      library_attended: parsed.data.libraryAttended,
      seva_minutes: parsed.data.sevaMinutes,
      note: parsed.data.note,
  };
  const entryPayload = { ...legacyPayload, morning_arati_status: parsed.data.morningAratiStatus, maha_mantra_path: parsed.data.morningAratiStatus === "present" ? null : (parsed.data.mahaMantraPath ?? null), maha_mantra_purged_at: null };
  let { error } = await supabase.from("daily_entries").upsert(
    entryPayload,
    { onConflict: "student_id,entry_date" },
  );
  if (isMissingSchemaError(error)) {
    const compatibilityPayload = { ...entryPayload } as Record<string, unknown>;
    delete compatibilityPayload.maha_mantra_purged_at;
    ({ error } = await supabase.from("daily_entries").upsert(compatibilityPayload, { onConflict: "student_id,entry_date" }));
  }
  if (error) {
    console.error("Daily entry upsert failed", {
      stage: "save",
      code: error.code,
      context: { targetStudentId, entryDate: parsed.data.entryDate, morningAratiStatus: parsed.data.morningAratiStatus },
    });
    return { status: "error", message: "The entry could not be saved." };
  }

  if (profile.role !== "student") {
    await createAdminClient().from("audit_events").insert({ actor_id: profile.id, action: "entry_corrected", target_id: targetStudentId, metadata: { date: parsed.data.entryDate } });
  }

  revalidatePath("/student");
  revalidatePath("/student/progress");
  revalidatePath("/admin/daily-tracking");
  revalidatePath("/mentor/daily-tracking");
  revalidatePath(`/admin/students/${targetStudentId}`);
  revalidatePath(`/mentor/students/${targetStudentId}`);
  return { status: "success", message: "Daily entry saved." };
}
