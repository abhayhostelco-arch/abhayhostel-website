import type { AlertSettings, DailyEntry, Profile } from "@/lib/types";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function sleepDurationMinutes(sleepTime: string, wakeTime: string): number {
  const sleep = timeToMinutes(sleepTime);
  const wake = timeToMinutes(wakeTime);
  const difference = wake - sleep;
  return difference <= 0 ? difference + 1440 : difference;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function total(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

export function totalRecorded(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => value !== null);
  return recorded.length === 0 ? null : total(recorded);
}

export function averageClock(values: string[], overnight = false): number | null {
  if (values.length === 0) return null;
  const minutes = values.map(timeToMinutes).map((value) => {
    if (overnight && value < 12 * 60) return value + 1440;
    return value;
  });
  const result = average(minutes);
  return result === null ? null : result % 1440;
}

export function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatClock(value: number | null): string {
  if (value === null) return "—";
  const normalized = Math.round(value) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)));
}

export type DerivedAlert = {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  type: "missing" | "sleep" | "study" | "absence";
  message: string;
};

export function deriveAlerts(
  students: Profile[],
  entries: DailyEntry[],
  settings: AlertSettings,
  rangeDays = 7,
  now = new Date(),
): DerivedAlert[] {
  const today = todayInIndia(now);
  const start = daysAgoInIndia(rangeDays, now);
  const entryMap = new Map(entries.map((entry) => [`${entry.student_id}:${entry.entry_date}`, entry]));
  const alerts: DerivedAlert[] = [];

  for (const student of students.filter((profile) => profile.is_active)) {
    const cursor = new Date(`${start}T12:00:00+05:30`);
    const end = new Date(`${today}T12:00:00+05:30`);
    while (cursor < end) {
      const date = cursor.toISOString().slice(0, 10);
      const entry = entryMap.get(`${student.id}:${date}`);
      if (!entry && settings.missed_entry_enabled) {
        alerts.push({
          id: `${student.id}:${date}:missing`,
          date,
          studentId: student.id,
          studentName: student.full_name,
          type: "missing",
          message: "Daily entry was not submitted.",
        });
      }
      if (entry) {
        const sleep = sleepDurationMinutes(entry.sleep_time, entry.wake_time);
        if (
          settings.sleep_alert_enabled &&
          (sleep < settings.min_sleep_minutes || sleep > settings.max_sleep_minutes)
        ) {
          alerts.push({
            id: `${student.id}:${date}:sleep`,
            date,
            studentId: student.id,
            studentName: student.full_name,
            type: "sleep",
            message: `Sleep duration was ${formatMinutes(sleep)}.`,
          });
        }
        if (settings.study_alert_enabled && entry.study_minutes < settings.min_study_minutes) {
          alerts.push({
            id: `${student.id}:${date}:study`,
            date,
            studentId: student.id,
            studentName: student.full_name,
            type: "study",
            message: `Study duration was ${formatMinutes(entry.study_minutes)}.`,
          });
        }
        if (settings.absence_alert_enabled && entry.academy_status === "absent") {
          alerts.push({
            id: `${student.id}:${date}:absence`,
            date,
            studentId: student.id,
            studentName: student.full_name,
            type: "absence",
            message: "Student was absent from academy.",
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return alerts.sort((a, b) => b.date.localeCompare(a.date));
}
