import type { GitaClassAttendance, GitaClassStatus } from "@/lib/types";

export type AttendanceSheetRow = { studentId: string; status: GitaClassStatus };

export function validateCompleteAttendanceSheet(
  eligibleStudentIds: string[],
  rows: AttendanceSheetRow[],
): { valid: true; rows: AttendanceSheetRow[] } | { valid: false; message: string } {
  const eligible = new Set(eligibleStudentIds);
  const seen = new Set<string>();
  for (const row of rows) {
    if (!eligible.has(row.studentId) || seen.has(row.studentId)) {
      return { valid: false, message: "The attendance sheet contains an invalid or duplicate student." };
    }
    seen.add(row.studentId);
  }
  if (seen.size !== eligible.size) {
    return { valid: false, message: "Choose Present, Absent, or No Class for every eligible student." };
  }
  return { valid: true, rows };
}

export type AttendanceDaySummary = {
  date: string;
  present: number | null;
  absent: number | null;
  noClass: boolean;
  recorded: number;
  expected: number;
  complete: boolean;
};

export function summarizeAttendanceDays(
  dates: string[],
  eligibleStudentIds: string[],
  records: GitaClassAttendance[],
): AttendanceDaySummary[] {
  const eligible = new Set(eligibleStudentIds);
  return dates.map((date) => {
    const day = records.filter((record) => record.attendance_date === date && eligible.has(record.student_id));
    const complete = eligible.size > 0 && day.length === eligible.size;
    const allNoClass = complete && day.every((record) => record.status === "no_class");
    return {
      date,
      present: day.length ? day.filter((record) => record.status === "present").length : null,
      absent: day.length ? day.filter((record) => record.status === "absent").length : null,
      noClass: allNoClass,
      recorded: day.length,
      expected: eligible.size,
      complete,
    };
  });
}
