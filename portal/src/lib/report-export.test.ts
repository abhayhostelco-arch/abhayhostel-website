import { describe, expect, it } from "vitest";
import { buildReportRows } from "@/lib/report-export";
import type { DailyEntry, Profile } from "@/lib/types";

const student = {
  id: "00000000-0000-4000-8000-000000000001",
  full_name: "Test Student",
  email: "student@example.com",
  academy_label: "Class 12",
} as Profile;

function entry(chantingRounds: number | null): DailyEntry {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    student_id: student.id,
    entry_date: "2026-08-22",
    sleep_time: "22:30:00",
    wake_time: "06:00:00",
    study_minutes: 240,
    chanting_rounds: chantingRounds,
    academy_status: "present",
    note: null,
    created_at: "2026-08-22T00:00:00Z",
    updated_at: "2026-08-22T00:00:00Z",
  };
}

describe("report export rows", () => {
  it("includes chanting rounds and preserves an unrecorded legacy value", () => {
    const rows = buildReportRows([entry(16), entry(null)], [student]);
    expect(rows[0]).toContain("Chanting rounds");
    const roundsColumn = rows[0].indexOf("Chanting rounds");
    expect(rows[1][roundsColumn]).toBe(16);
    expect(rows[2][roundsColumn]).toBeNull();
  });
});
