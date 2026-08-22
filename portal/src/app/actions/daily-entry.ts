"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isWithinEntryWindow } from "@/lib/date";
import { sleepDurationMinutes } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { dailyEntrySchema, flattenErrors } from "@/lib/validation";

export async function saveDailyEntryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile(["student"]);
  const parsed = dailyEntrySchema.safeParse({
    entryDate: formData.get("entryDate"),
    sleepTime: formData.get("sleepTime"),
    wakeTime: formData.get("wakeTime"),
    studyHours: formData.get("studyHours"),
    studyMinutes: formData.get("studyMinutes"),
    chantingRounds: formData.get("chantingRounds"),
    gitaClassStatus: formData.get("gitaClassStatus"),
    morningAratiAttended: formData.get("morningAratiAttended") === "on",
    eveningReadingMinutes: formData.get("eveningReadingMinutes"),
    libraryAttended: formData.get("libraryAttended") === "on",
    sevaMinutes: formData.get("sevaMinutes"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  }
  if (!isWithinEntryWindow(parsed.data.entryDate)) {
    return { status: "error", message: "Choose a date within the last 90 days." };
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
  const { error } = await supabase.from("daily_entries").upsert(
    {
      student_id: profile.id,
      entry_date: parsed.data.entryDate,
      sleep_time: parsed.data.sleepTime,
      wake_time: parsed.data.wakeTime,
      study_minutes: studyMinutes,
      chanting_rounds: parsed.data.chantingRounds,
      gita_class_status: parsed.data.gitaClassStatus,
      morning_arati_attended: parsed.data.morningAratiAttended,
      evening_reading_minutes: parsed.data.eveningReadingMinutes,
      library_attended: parsed.data.libraryAttended,
      seva_minutes: parsed.data.sevaMinutes,
      note: parsed.data.note,
    },
    { onConflict: "student_id,entry_date" },
  );
  if (error) return { status: "error", message: "The entry could not be saved." };

  revalidatePath("/student");
  revalidatePath("/student/progress");
  return { status: "success", message: "Daily entry saved." };
}
