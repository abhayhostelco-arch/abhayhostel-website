import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AlertSettings, AttendanceEvent, AttendancePerson, AttendanceRecord, DailyEntry, GitaClassAttendance, LeaveRequest, LeaveStatus, Profile, ScoreSettings, SharedResource, WeeklyProgram, WeeklyProgramEntry } from "@/lib/types";
import { isMissingSchemaError } from "@/lib/schema-compat";

export async function getProfiles(role?: "admin" | "student", activeOnly = false): Promise<Profile[]> {
  const supabase = await createClient();
  let query = supabase.from("profiles").select("*").order("full_name").limit(500);
  if (role) query = query.eq("role", role);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load profiles.");
  return (data ?? []) as Profile[];
}

export async function getEntries(options: {
  startDate: string;
  studentId?: string;
  studentIds?: string[];
}): Promise<DailyEntry[]> {
  if (options.studentIds?.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from("daily_entries")
    .select("*")
    .gte("entry_date", options.startDate)
    .order("entry_date", { ascending: false })
    .limit(5000);
  if (options.studentId) query = query.eq("student_id", options.studentId);
  else if (options.studentIds) query = query.in("student_id", options.studentIds);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load daily entries.");
  return (data ?? []) as DailyEntry[];
}

export async function getAlertSettings(): Promise<AlertSettings> {
  // Callers authenticate and authorize before loading this global singleton.
  // Reading it with the server-only client avoids coupling page rendering to
  // the requesting session's RLS token refresh state.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("alert_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw new Error("Unable to load alert settings.");
  return data as AlertSettings;
}

export async function getScoreSettings(): Promise<ScoreSettings> {
  // Scores are calculated on the server after the page has required an active
  // profile. Keep the global rubric read reliable even when an old browser
  // session has not yet refreshed its database claims.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("score_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw new Error("Unable to load score settings.");
  const settings = data as ScoreSettings;
  return {
    ...settings,
    wake_target_time: settings.wake_target_time.slice(0, 5) === "06:00" ? "04:00:00" : settings.wake_target_time,
    bedtime_target_time: settings.bedtime_target_time.slice(0, 5) === "22:30" ? "20:30:00" : settings.bedtime_target_time,
  };
}

export async function getStudentLeaderboardSource(startDate: string): Promise<{ students: Profile[]; entries: DailyEntry[] }> {
  const admin = createAdminClient();
  const profilesResult = await admin.from("profiles").select("*").eq("role", "student").eq("is_active", true).order("full_name").limit(500);
  if (profilesResult.error) throw new Error("Unable to load leaderboard data.");
  const studentIds = (profilesResult.data ?? []).map((profile) => profile.id);
  if (studentIds.length === 0) return { students: [], entries: [] };
  const entriesResult = await admin.from("daily_entries").select("*").in("student_id", studentIds).gte("entry_date", startDate).order("entry_date", { ascending: false }).limit(5000);
  if (entriesResult.error) throw new Error("Unable to load leaderboard data.");
  return { students: (profilesResult.data ?? []) as Profile[], entries: (entriesResult.data ?? []) as DailyEntry[] };
}

export async function getSharedResources(includeArchived = false): Promise<SharedResource[]> {
  const admin = createAdminClient();
  let query = admin.from("shared_resources").select("*").order("created_at", { ascending: false }).limit(500);
  if (!includeArchived) query = query.eq("is_published", true);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load resources.");
  return (data ?? []) as SharedResource[];
}

export async function getWeeklyPrograms(): Promise<WeeklyProgram[]> {
  const { data, error } = await createAdminClient().from("weekly_programs").select("*").order("program_date", { ascending: false }).limit(100);
  if (error) throw new Error("Unable to load weekly programs.");
  return (data ?? []) as WeeklyProgram[];
}

export async function getWeeklyProgramEntries(studentIds: string[]): Promise<WeeklyProgramEntry[]> {
  if (studentIds.length === 0) return [];
  const { data, error } = await createAdminClient().from("weekly_program_entries").select("*").in("student_id", studentIds).order("updated_at", { ascending: false }).limit(5000);
  if (error) throw new Error("Unable to load weekly entries.");
  return (data ?? []) as WeeklyProgramEntry[];
}

export async function getAttendancePeople(profileIds: string[] | null): Promise<AttendancePerson[]> {
  if (profileIds?.length === 0) return [];
  let query = createAdminClient().from("attendance_people").select("*").order("name").limit(1000);
  if (profileIds) query = query.in("profile_id", profileIds);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load attendance people.");
  return (data ?? []) as AttendancePerson[];
}

export async function getAttendanceEvents(): Promise<AttendanceEvent[]> {
  const { data, error } = await createAdminClient().from("attendance_events").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Unable to load attendance events.");
  return (data ?? []) as AttendanceEvent[];
}

export async function getAttendanceRecords(startDate: string, personIds: string[] | null): Promise<AttendanceRecord[]> {
  if (personIds?.length === 0) return [];
  let query = createAdminClient().from("attendance_records").select("*").gte("attendance_date", startDate).order("attendance_date", { ascending: false }).limit(5000);
  if (personIds) query = query.in("person_id", personIds);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load attendance records.");
  return (data ?? []) as AttendanceRecord[];
}

export async function getAttendanceEventPeople(personIds: string[] | null): Promise<Array<{ event_id: string; person_id: string }>> {
  if (personIds?.length === 0) return [];
  let query = createAdminClient().from("attendance_event_people").select("*").limit(5000);
  if (personIds) query = query.in("person_id", personIds);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load attendance mappings.");
  return data ?? [];
}

export async function getProfileEnhancements(profileId: string): Promise<{
  available: boolean;
  birthDate: string | null;
  avatarPath: string | null;
}> {
  const { data, error } = await (await createClient())
    .from("profiles")
    .select("birth_date,avatar_path")
    .eq("id", profileId)
    .maybeSingle();
  if (isMissingSchemaError(error)) return { available: false, birthDate: null, avatarPath: null };
  if (error) throw new Error("Unable to load profile settings.");
  return {
    available: true,
    birthDate: data?.birth_date ?? null,
    avatarPath: data?.avatar_path ?? null,
  };
}

export async function getAvatarSignedUrl(avatarPath?: string | null): Promise<string | null> {
  if (!avatarPath) return null;
  const { data, error } = await createAdminClient().storage
    .from("student-avatars")
    .createSignedUrl(avatarPath, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function getPrivateUploadSignedUrl(bucket: "maha-mantra-evidence" | "leave-applications", path?: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function getGitaAttendance(
  startDate: string,
  studentIds: string[],
): Promise<{ available: boolean; records: GitaClassAttendance[] }> {
  if (studentIds.length === 0) return { available: true, records: [] };
  const { data, error } = await createAdminClient()
    .from("gita_class_attendance")
    .select("*")
    .in("student_id", studentIds)
    .gte("attendance_date", startDate)
    .order("attendance_date", { ascending: false })
    .limit(5000);
  if (isMissingSchemaError(error)) return { available: false, records: [] };
  if (error) throw new Error("Unable to load official Gita attendance.");
  return { available: true, records: (data ?? []) as GitaClassAttendance[] };
}

export async function getLeaveRequests(options: {
  month?: string;
  studentId?: string;
  status?: LeaveStatus;
} = {}): Promise<{ available: boolean; requests: LeaveRequest[] }> {
  const supabase = await createClient();
  let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(1000);
  if (options.month) {
    const [year, month] = options.month.split("-").map(Number);
    const start = `${options.month}-01`;
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    query = query.lte("start_date", end).gte("end_date", start);
  }
  if (options.studentId) query = query.eq("student_id", options.studentId);
  if (options.status) query = query.eq("status", options.status);
  const { data, error } = await query;
  if (isMissingSchemaError(error)) return { available: false, requests: [] };
  if (error) throw new Error("Unable to load leave requests.");
  return { available: true, requests: (data ?? []) as LeaveRequest[] };
}
