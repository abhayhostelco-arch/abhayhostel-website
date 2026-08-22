import { sleepDurationMinutes } from "@/lib/analytics";
import type { DailyEntry, Profile } from "@/lib/types";

export function buildReportRows(entries: DailyEntry[], students: Profile[]): unknown[][] {
  const names = new Map(students.map((student) => [student.id, student]));
  const rows: unknown[][] = [[
    "Student", "Email", "Academy / class", "Date", "Sleep time", "Wake time",
    "Sleep minutes", "Study minutes", "Chanting rounds", "Academy status",
    "Note", "Created at", "Updated at",
  ]];

  for (const entry of entries.slice(0, 5000)) {
    const student = names.get(entry.student_id);
    rows.push([
      student?.full_name,
      student?.email,
      student?.academy_label,
      entry.entry_date,
      entry.sleep_time.slice(0, 5),
      entry.wake_time.slice(0, 5),
      sleepDurationMinutes(entry.sleep_time, entry.wake_time),
      entry.study_minutes,
      entry.chanting_rounds,
      entry.academy_status,
      entry.note,
      entry.created_at,
      entry.updated_at,
    ]);
  }

  return rows;
}
