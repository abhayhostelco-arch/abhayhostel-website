import { sleepDurationMinutes } from "@/lib/analytics";
import { buildGrowthReport, roundedScores } from "@/lib/growth-score";
import type { DailyEntry, Profile, ScoreSettings } from "@/lib/types";

export function buildReportRows(entries: DailyEntry[], students: Profile[], settings: ScoreSettings, rangeDays: number, now = new Date()): unknown[][] {
  const names = new Map(students.map((student) => [student.id, student]));
  const entryMap = new Map(entries.map((entry) => [`${entry.student_id}:${entry.entry_date}`, entry]));
  const growth = buildGrowthReport(students, entries, settings, rangeDays, now);
  const rows: unknown[][] = [[
    "Student", "Email", "Academy / class", "Date", "Submission status", "Sleep time", "Wake time",
    "Sleep minutes", "Study minutes", "Chanting rounds", "Morning Arati", "Gita class status",
    "Evening reading minutes", "Library attended", "Seva minutes", "Sadhana score", "Study score",
    "Discipline score", "Seva & Character score", "Overall Growth Score", "Note", "Created at", "Updated at",
  ]];

  for (const report of growth.students) {
    const student = names.get(report.studentId);
    for (const day of report.daily) {
      if (rows.length > 5000) return rows;
      const entry = entryMap.get(`${report.studentId}:${day.date}`);
      const scores = roundedScores(day);
      rows.push([
        student?.full_name, student?.email, student?.academy_label, day.date, entry ? "Submitted" : "Missing",
        entry?.sleep_time.slice(0, 5) ?? null, entry?.wake_time.slice(0, 5) ?? null,
        entry ? sleepDurationMinutes(entry.sleep_time, entry.wake_time) : null,
        entry?.study_minutes ?? null, entry?.chanting_rounds ?? null, entry?.morning_arati_attended ?? null,
        entry?.gita_class_status ?? null, entry?.evening_reading_minutes ?? null, entry?.library_attended ?? null,
        entry?.seva_minutes ?? null, scores.sadhana, scores.study, scores.discipline, scores.seva, scores.overall,
        entry?.note ?? null, entry?.created_at ?? null, entry?.updated_at ?? null,
      ]);
    }
  }

  return rows;
}
