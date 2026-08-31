export type AppRole = "super_admin" | "admin" | "student";
export type StudentGroup = "abhay_hostel" | "krishna_home";
export type GitaClassStatus = "present" | "absent" | "no_class";
export type MorningAratiStatus = "present" | "late" | "absent";
export type LeaveStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string;
  email: string;
  phone: string | null;
  academy_label: string | null;
  joined_on: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_by: string | null;
  mentor_id: string | null;
  student_group?: StudentGroup | null;
  birth_date?: string | null;
  avatar_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitaClassAttendance {
  id: string;
  student_id: string;
  attendance_date: string;
  status: GitaClassStatus;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface DailyEntry {
  id: string;
  student_id: string;
  entry_date: string;
  sleep_time: string;
  wake_time: string;
  study_minutes: number;
  chanting_rounds: number | null;
  gita_class_status: GitaClassStatus;
  morning_arati_attended: boolean;
  morning_arati_status?: MorningAratiStatus;
  maha_mantra_path?: string | null;
  evening_reading_minutes: number;
  library_attended: boolean;
  seva_minutes: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_path: string | null;
  status: LeaveStatus;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoreSettings {
  id: boolean;
  sadhana_weight: number;
  study_weight: number;
  discipline_weight: number;
  seva_weight: number;
  chanting_target_rounds: number;
  evening_reading_target_minutes: number;
  study_target_minutes: number;
  wake_target_time: string;
  bedtime_target_time: string;
  seva_target_minutes: number;
  discipline_grace_minutes: number;
  score_start_date: string;
  updated_by: string | null;
  updated_at: string;
}

export interface AlertSettings {
  id: boolean;
  missed_entry_enabled: boolean;
  sleep_alert_enabled: boolean;
  min_sleep_minutes: number;
  max_sleep_minutes: number;
  study_alert_enabled: boolean;
  min_study_minutes: number;
  absence_alert_enabled: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface SharedResource {
  id: string;
  title: string;
  url: string;
  category: string | null;
  is_published: boolean;
  created_at: string;
}

export interface WeeklyProgram {
  id: string;
  program_date: string;
  is_active: boolean;
  created_at: string;
}

export interface WeeklyProgramEntry {
  id: string;
  program_id: string;
  student_id: string;
  attendance: "present" | "absent";
  wore_dhoti_kurta: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendancePerson {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface AttendanceEvent {
  id: string;
  name: string;
  status_options: string[];
  is_active: boolean;
}

export interface AttendanceRecord {
  id: string;
  event_id: string;
  person_id: string;
  attendance_date: string;
  status: string;
  remark: string | null;
}

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  temporaryPassword?: string;
  analytics?: {
    name: string;
    params: Record<string, string | number | boolean | null>;
  };
};

export const initialActionState: ActionState = { status: "idle" };
