import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AlertSettings, DailyEntry, Profile, ScoreSettings } from "@/lib/types";

export async function getProfiles(role?: "admin" | "student"): Promise<Profile[]> {
  const supabase = await createClient();
  let query = supabase.from("profiles").select("*").order("full_name").limit(500);
  if (role) query = query.eq("role", role);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load profiles.");
  return (data ?? []) as Profile[];
}

export async function getEntries(options: {
  startDate: string;
  studentId?: string;
}): Promise<DailyEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("daily_entries")
    .select("*")
    .gte("entry_date", options.startDate)
    .order("entry_date", { ascending: false })
    .limit(5000);
  if (options.studentId) query = query.eq("student_id", options.studentId);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load daily entries.");
  return (data ?? []) as DailyEntry[];
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alert_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw new Error("Unable to load alert settings.");
  return data as AlertSettings;
}

export async function getScoreSettings(): Promise<ScoreSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("score_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw new Error("Unable to load score settings.");
  return data as ScoreSettings;
}

export async function getStudentLeaderboardSource(startDate: string): Promise<{ students: Profile[]; entries: DailyEntry[] }> {
  const admin = createAdminClient();
  const [profilesResult, entriesResult] = await Promise.all([
    admin.from("profiles").select("*").eq("role", "student").eq("is_active", true).order("full_name").limit(500),
    admin.from("daily_entries").select("*").gte("entry_date", startDate).order("entry_date", { ascending: false }).limit(5000),
  ]);
  if (profilesResult.error || entriesResult.error) throw new Error("Unable to load leaderboard data.");
  return { students: (profilesResult.data ?? []) as Profile[], entries: (entriesResult.data ?? []) as DailyEntry[] };
}
