"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { alertSettingsSchema, flattenErrors, scoreStartDateSchema } from "@/lib/validation";

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
  revalidatePath("/admin/settings");
  return { status: "success", message: "Alert settings updated." };
}

export async function updateScoreSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = scoreStartDateSchema.safeParse({
    scoreStartDate: formData.get("scoreStartDate"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Review the scoring launch date." };

  const supabase = await createClient();
  const { error } = await supabase.from("score_settings").update({
    score_start_date: parsed.data.scoreStartDate,
    updated_by: actor.id,
  }).eq("id", true);
  if (error) return { status: "error", message: "Scoring launch date could not be updated." };

  await createAdminClient().from("audit_events").insert({
    actor_id: actor.id,
    action: "score_settings_updated",
    target_id: null,
    metadata: {},
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/reports");
  revalidatePath("/student/progress");
  return { status: "success", message: "Scoring launch date updated." };
}
