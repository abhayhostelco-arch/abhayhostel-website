export type AppRole = "super_admin" | "admin" | "student";
export type AcademyStatus = "present" | "absent" | "no_class";

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
  academy_status: AcademyStatus;
  note: string | null;
  created_at: string;
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

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  temporaryPassword?: string;
};

export const initialActionState: ActionState = { status: "idle" };
