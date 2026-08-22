"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { alertSettingsSchema, flattenErrors, scoreSettingsSchema } from "@/lib/validation";

export async function updateAlertSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = alertSettingsSchema.safeParse({
    missedEntryEnabled: formData.get("missedEntryEnabled") === "on",
    sleepAlertEnabled: formData.get("sleepAlertEnabled") === "on",
    minSleepMinutes: formData.get("minSleepMinutes"),
    maxSleepMinutes: formData.get("maxSleepMinutes"),
    studyAlertEnabled: formData.get("studyAlertEnabled") === "on",
    minStudyMinutes: formData.get("minStudyMinutes"),
    absenceAlertEnabled: formData.get("absenceAlertEnabled") === "on",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("alert_settings")
    .update({
      missed_entry_enabled: parsed.data.missedEntryEnabled,
      sleep_alert_enabled: parsed.data.sleepAlertEnabled,
      min_sleep_minutes: parsed.data.minSleepMinutes,
      max_sleep_minutes: parsed.data.maxSleepMinutes,
      study_alert_enabled: parsed.data.studyAlertEnabled,
      min_study_minutes: parsed.data.minStudyMinutes,
      absence_alert_enabled: parsed.data.absenceAlertEnabled,
      updated_by: actor.id,
    })
    .eq("id", true);
  if (error) return { status: "error", message: "Settings could not be updated." };

  await createAdminClient().from("audit_events").insert({
    actor_id: actor.id,
    action: "settings_updated",
    target_id: null,
    metadata: {},
  });
  revalidatePath("/admin/alerts");
  revalidatePath("/admin/settings");
  return { status: "success", message: "Alert settings updated." };
}

export async function updateScoreSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = scoreSettingsSchema.safeParse({
    sadhanaWeight: formData.get("sadhanaWeight"),
    studyWeight: formData.get("studyWeight"),
    disciplineWeight: formData.get("disciplineWeight"),
    sevaWeight: formData.get("sevaWeight"),
    chantingTargetRounds: formData.get("chantingTargetRounds"),
    eveningReadingTargetMinutes: formData.get("eveningReadingTargetMinutes"),
    studyTargetMinutes: formData.get("studyTargetMinutes"),
    wakeTargetTime: formData.get("wakeTargetTime"),
    bedtimeTargetTime: formData.get("bedtimeTargetTime"),
    sevaTargetMinutes: formData.get("sevaTargetMinutes"),
    disciplineGraceMinutes: formData.get("disciplineGraceMinutes"),
    scoreStartDate: formData.get("scoreStartDate"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Review the score settings." };

  const supabase = await createClient();
  const { error } = await supabase.from("score_settings").update({
    sadhana_weight: parsed.data.sadhanaWeight,
    study_weight: parsed.data.studyWeight,
    discipline_weight: parsed.data.disciplineWeight,
    seva_weight: parsed.data.sevaWeight,
    chanting_target_rounds: parsed.data.chantingTargetRounds,
    evening_reading_target_minutes: parsed.data.eveningReadingTargetMinutes,
    study_target_minutes: parsed.data.studyTargetMinutes,
    wake_target_time: parsed.data.wakeTargetTime,
    bedtime_target_time: parsed.data.bedtimeTargetTime,
    seva_target_minutes: parsed.data.sevaTargetMinutes,
    discipline_grace_minutes: parsed.data.disciplineGraceMinutes,
    score_start_date: parsed.data.scoreStartDate,
    updated_by: actor.id,
  }).eq("id", true);
  if (error) return { status: "error", message: "Growth Score settings could not be updated." };

  await createAdminClient().from("audit_events").insert({
    actor_id: actor.id,
    action: "score_settings_updated",
    target_id: null,
    metadata: {},
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/reports");
  revalidatePath("/student/progress");
  return { status: "success", message: "Growth Score settings updated." };
}
