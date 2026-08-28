import { describe, expect, it } from "vitest";
import { summarizeAttendanceDays, validateCompleteAttendanceSheet } from "@/lib/gita-attendance";
import type { GitaClassAttendance } from "@/lib/types";

const record = (studentId: string, date: string, status: GitaClassAttendance["status"]): GitaClassAttendance => ({
  id: crypto.randomUUID(), student_id: studentId, attendance_date: date, status,
  recorded_by: "staff", created_at: "2026-08-28T00:00:00Z", updated_at: "2026-08-28T00:00:00Z",
});

describe("official Gita attendance", () => {
  it("rejects partial and duplicate sheets", () => {
    expect(validateCompleteAttendanceSheet(["a", "b"], [{ studentId: "a", status: "present" }]).valid).toBe(false);
    expect(validateCompleteAttendanceSheet(["a"], [
      { studentId: "a", status: "present" }, { studentId: "a", status: "absent" },
    ]).valid).toBe(false);
  });

  it("accepts a complete sheet", () => {
    expect(validateCompleteAttendanceSheet(["a", "b"], [
      { studentId: "a", status: "present" }, { studentId: "b", status: "no_class" },
    ]).valid).toBe(true);
  });

  it("preserves unrecorded dates as gaps and identifies no-class dates", () => {
    const summaries = summarizeAttendanceDays(
      ["2026-08-26", "2026-08-27", "2026-08-28"],
      ["a", "b"],
      [record("a", "2026-08-27", "no_class"), record("b", "2026-08-27", "no_class"), record("a", "2026-08-28", "present"), record("b", "2026-08-28", "absent")],
    );
    expect(summaries[0]).toMatchObject({ present: null, absent: null, complete: false });
    expect(summaries[1]).toMatchObject({ present: 0, noClass: true, complete: true });
    expect(summaries[2]).toMatchObject({ present: 1, absent: 1, complete: true });
  });
});
