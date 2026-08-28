"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { todayInIndia } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";
import { attendanceEventSchema, attendancePersonSchema, attendanceRecordSchema, resourceSchema, weeklyEntrySchema, weeklyProgramSchema } from "@/lib/validation";

async function audit(actorId: string, action: string, targetId: string | null, metadata: Record<string, string | boolean> = {}) {
  await createAdminClient().from("audit_events").insert({ actor_id: actorId, action, target_id: targetId, metadata });
}

export async function saveResourceAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = resourceSchema.safeParse({
    resourceId: formData.get("resourceId") || undefined, title: formData.get("title"), url: formData.get("url"),
    category: formData.get("category") ?? "", published: formData.get("published") === "on",
  });
  if (!parsed.success) return;
  const supabase = createAdminClient();
  const payload = { title: parsed.data.title, url: parsed.data.url, category: parsed.data.category, is_published: parsed.data.published };
  const result = parsed.data.resourceId
    ? await supabase.from("shared_resources").update(payload).eq("id", parsed.data.resourceId)
    : await supabase.from("shared_resources").insert({ ...payload, created_by: actor.id }).select("id").single();
  if (result.error) return;
  const targetId = parsed.data.resourceId ?? ("data" in result ? (result.data as { id?: string } | null)?.id ?? null : null);
  await audit(actor.id, parsed.data.resourceId ? "resource_updated" : "resource_created", targetId);
  revalidatePath("/resources");
}

export async function toggleResourceAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin"]);
  const id = String(formData.get("resourceId") ?? "");
  const published = formData.get("published") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await createAdminClient().from("shared_resources").update({ is_published: published }).eq("id", id);
  if (!error) await audit(actor.id, "resource_updated", id, { published });
  revalidatePath("/resources");
}

export async function createWeeklyProgramAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = weeklyProgramSchema.safeParse({ programDate: formData.get("programDate") });
  if (!parsed.success || parsed.data.programDate < todayInIndia()) {
    return { status: "error", message: "Choose today or a future date." };
  }
  const supabase = createAdminClient();
  const [{ data: existing, error: existingError }, { data: active, error: activeError }] = await Promise.all([
    supabase.from("weekly_programs").select("id,is_active").eq("program_date", parsed.data.programDate).maybeSingle(),
    supabase.from("weekly_programs").select("id").eq("is_active", true).maybeSingle(),
  ]);
  if (existingError || activeError) return { status: "error", message: "The session could not be checked. Try again." };
  if (existing?.is_active) {
    revalidatePath("/weekly-program");
    redirect("/weekly-program");
  }
  if (active) {
    const { error: closeError } = await supabase.from("weekly_programs").update({ is_active: false }).eq("id", active.id);
    if (closeError) return { status: "error", message: "The current session could not be closed." };
  }
  if (existing) {
    const { error: reopenError } = await supabase.from("weekly_programs").update({ is_active: true }).eq("id", existing.id);
    if (reopenError) {
      if (active) await supabase.from("weekly_programs").update({ is_active: true }).eq("id", active.id);
      return { status: "error", message: "The existing session could not be reopened. Try again." };
    }
    await audit(actor.id, "weekly_program_reopened", existing.id);
    revalidatePath("/weekly-program");
    redirect("/weekly-program");
  }
  const { data, error } = await supabase.from("weekly_programs").insert({ program_date: parsed.data.programDate, created_by: actor.id, is_active: true }).select("id").single();
  if (error || !data) {
    if (active) await supabase.from("weekly_programs").update({ is_active: true }).eq("id", active.id);
    return { status: "error", message: error?.code === "23505" ? "A Weekly Program already exists for this date." : "The session could not be opened. Try again." };
  }
  await audit(actor.id, "weekly_program_created", data.id);
  revalidatePath("/weekly-program");
  redirect("/weekly-program");
}

export async function closeWeeklyProgramAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin"]);
  const id = String(formData.get("programId") ?? "");
  const { error } = await createAdminClient().from("weekly_programs").update({ is_active: false }).eq("id", id);
  if (!error) await audit(actor.id, "weekly_program_closed", id);
  revalidatePath("/weekly-program");
}

export async function saveWeeklyEntryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["student"]);
  const parsed = weeklyEntrySchema.safeParse({
    programId: formData.get("programId"), attendance: formData.get("attendance"), woreDhotiKurta: formData.get("woreDhotiKurta") === "true",
  });
  if (!parsed.success) return { status: "error", message: "Choose an answer for each Weekly Program question." };
  const admin = createAdminClient();
  const { data: program } = await admin.from("weekly_programs").select("id").eq("id", parsed.data.programId).eq("is_active", true).maybeSingle();
  if (!program) return { status: "error", message: "This Weekly Program session is no longer active." };
  const { error } = await admin.from("weekly_program_entries").upsert({
    program_id: parsed.data.programId, student_id: actor.id, attendance: parsed.data.attendance,
    wore_dhoti_kurta: parsed.data.woreDhotiKurta,
  }, { onConflict: "program_id,student_id" });
  if (error) return { status: "error", message: "Your Weekly Program report could not be saved. Try again." };
  revalidatePath("/weekly-program");
  return { status: "success", message: "Weekly report saved." };
}

export async function createAttendancePersonAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = attendancePersonSchema.safeParse({ name: formData.get("name"), phone: formData.get("phone") ?? "", notes: formData.get("notes") ?? "", profileId: formData.get("profileId") || undefined });
  if (!parsed.success) return;
  const { data, error } = await createAdminClient().from("attendance_people").insert({
    name: parsed.data.name, phone: parsed.data.phone, notes: parsed.data.notes, profile_id: parsed.data.profileId ?? null, created_by: actor.id,
  }).select("id").single();
  if (!error && data) await audit(actor.id, "attendance_person_created", data.id);
  revalidatePath("/attendance");
}

export async function createAttendanceEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = attendanceEventSchema.safeParse({ name: formData.get("name"), statuses: formData.get("statuses") });
  if (!parsed.success) return { status: "error", message: "Enter an event name and between 1 and 8 comma-separated statuses." };
  const { data, error } = await createAdminClient().from("attendance_events").insert({ name: parsed.data.name, status_options: parsed.data.statuses, created_by: actor.id }).select("id").single();
  if (error || !data) return { status: "error", message: "The event could not be created. Try again." };
  await audit(actor.id, "attendance_event_created", data.id);
  revalidatePath("/attendance");
  redirect(`/attendance?eventId=${data.id}&created=1`);
}

export async function toggleAttendancePersonAction(formData: FormData): Promise<void> {
  await requireProfile(["super_admin"]);
  const id = String(formData.get("personId") ?? "");
  const active = formData.get("active") === "true";
  if (/^[0-9a-f-]{36}$/i.test(id)) await createAdminClient().from("attendance_people").update({ is_active: active }).eq("id", id);
  revalidatePath("/attendance");
}

export async function toggleAttendanceEventAction(formData: FormData): Promise<void> {
  await requireProfile(["super_admin"]);
  const id = String(formData.get("eventId") ?? "");
  const active = formData.get("active") === "true";
  if (/^[0-9a-f-]{36}$/i.test(id)) await createAdminClient().from("attendance_events").update({ is_active: active }).eq("id", id);
  revalidatePath("/attendance");
}

export async function mapAttendancePersonAction(formData: FormData): Promise<void> {
  await requireProfile(["super_admin"]);
  const eventId = String(formData.get("eventId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f-]{36}$/i.test(personId)) return;
  await createAdminClient().from("attendance_event_people").upsert({ event_id: eventId, person_id: personId });
  revalidatePath("/attendance");
}

export async function saveAttendanceRecordAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin", "admin"]);
  const parsed = attendanceRecordSchema.safeParse({ eventId: formData.get("eventId"), personId: formData.get("personId"), attendanceDate: formData.get("attendanceDate"), status: formData.get("status"), remark: formData.get("remark") ?? "" });
  if (!parsed.success) return;
  const admin = createAdminClient();
  if (actor.role === "admin") {
    const { data: person } = await admin.from("attendance_people").select("profile_id").eq("id", parsed.data.personId).maybeSingle();
    if (!person?.profile_id) return;
    const { data: assignedStudent } = await admin.from("profiles").select("id").eq("id", person.profile_id).eq("role", "student").eq("mentor_id", actor.id).eq("is_active", true).maybeSingle();
    if (!assignedStudent) return;
  }
  const { data: event } = await admin.from("attendance_events").select("status_options").eq("id", parsed.data.eventId).maybeSingle();
  if (!event?.status_options.includes(parsed.data.status)) return;
  const { data: mapping } = await admin.from("attendance_event_people").select("event_id").eq("event_id", parsed.data.eventId).eq("person_id", parsed.data.personId).maybeSingle();
  if (!mapping) return;
  const { error } = await admin.from("attendance_records").upsert({
    event_id: parsed.data.eventId, person_id: parsed.data.personId, attendance_date: parsed.data.attendanceDate,
    status: parsed.data.status, remark: parsed.data.remark, recorded_by: actor.id,
  }, { onConflict: "event_id,person_id,attendance_date" });
  if (!error) await audit(actor.id, "attendance_recorded", parsed.data.personId, { event_id: parsed.data.eventId, date: parsed.data.attendanceDate });
  revalidatePath("/attendance");
}
