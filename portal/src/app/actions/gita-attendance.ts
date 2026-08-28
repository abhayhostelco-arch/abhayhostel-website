"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";
import { getProfiles } from "@/lib/data";
import { validateCompleteAttendanceSheet } from "@/lib/gita-attendance";
import { isMissingSchemaError } from "@/lib/schema-compat";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { gitaAttendanceDateSchema, gitaAttendanceStatusSchema } from "@/lib/validation";

export async function saveGitaAttendanceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const date = gitaAttendanceDateSchema.safeParse(formData.get("attendanceDate"));
  if (!date.success || date.data < daysAgoInIndia(89) || date.data > todayInIndia()) {
    return { status: "error", message: "Choose a date from today through the previous 89 days." };
  }
  const eligible = await getProfiles("student", true);
  if (eligible.length === 0) return { status: "error", message: "There are no eligible students in this attendance sheet." };
  const rows = eligible.flatMap((student) => {
    const status = gitaAttendanceStatusSchema.safeParse(formData.get(`status:${student.id}`));
    return status.success ? [{ studentId: student.id, status: status.data }] : [];
  });
  const complete = validateCompleteAttendanceSheet(eligible.map((student) => student.id), rows);
  if (!complete.valid) return { status: "error", message: complete.message };

  const payload = complete.rows.map((row) => ({
    student_id: row.studentId,
    attendance_date: date.data,
    status: row.status,
    recorded_by: actor.id,
  }));
  const { error } = await (await createClient()).from("gita_class_attendance").upsert(payload, {
    onConflict: "student_id,attendance_date",
  });
  if (isMissingSchemaError(error)) {
    return { status: "error", message: "Official Gita attendance is unavailable until the new migration is applied." };
  }
  if (error) return { status: "error", message: "Attendance was not saved. No changes were applied." };
  await createAdminClient().from("audit_events").insert({
    actor_id: actor.id,
    action: "attendance_recorded",
    target_id: null,
    metadata: { attendance_type: "gita_class", date: date.data, student_count: payload.length },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/gita-attendance");
  revalidatePath("/mentor/gita-attendance");
  return { status: "success", message: `Attendance saved for ${payload.length} students.` };
}
