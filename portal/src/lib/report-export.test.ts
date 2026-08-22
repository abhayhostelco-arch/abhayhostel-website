import { describe, expect, it } from "vitest";
import { buildReportRows } from "@/lib/report-export";
import type { DailyEntry, Profile, ScoreSettings } from "@/lib/types";

const student = {
  id: "00000000-0000-4000-8000-000000000001",
  full_name: "Test Student",
  email: "student@example.com",
  academy_label: "Class 12",
} as Profile;

const settings = { score_start_date: "2026-08-22", chanting_target_rounds: 16, evening_reading_target_minutes: 30, study_target_minutes: 240, wake_target_time: "06:00:00", bedtime_target_time: "22:30:00", seva_target_minutes: 60, discipline_grace_minutes: 120, sadhana_weight: 40, study_weight: 25, discipline_weight: 20, seva_weight: 15 } as ScoreSettings;

function entry(chantingRounds: number | null): DailyEntry {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    student_id: student.id,
    entry_date: "2026-08-22",
    sleep_time: "22:30:00",
    wake_time: "06:00:00",
    study_minutes: 240,
    chanting_rounds: chantingRounds,
    gita_class_status: "present",
    morning_arati_attended: true,
    evening_reading_minutes: 30,
    library_attended: true,
    seva_minutes: 60,
    note: null,
    created_at: "2026-08-22T00:00:00Z",
    updated_at: "2026-08-22T00:00:00Z",
  };
}

describe("report export rows", () => {
  it("includes chanting rounds and preserves an unrecorded legacy value", () => {
    const rows = buildReportRows([entry(16)], [{ ...student, is_active: true, joined_on: "2026-01-01" }], settings, 1, new Date("2026-08-22T06:30:00Z"));
    expect(rows[0]).toContain("Chanting rounds");
    const roundsColumn = rows[0].indexOf("Chanting rounds");
    expect(rows[1][roundsColumn]).toBe(16);
    expect(rows[0]).toContain("Overall Growth Score");
  });

  it("exports explicit zero-score rows for missing days", () => {
    const rows = buildReportRows([], [{ ...student, is_active: true, joined_on: "2026-01-01" }], { ...settings, score_start_date: "2026-08-21" }, 2, new Date("2026-08-22T06:30:00Z"));
    const statusColumn = rows[0].indexOf("Submission status");
    const scoreColumn = rows[0].indexOf("Overall Growth Score");
    expect(rows).toHaveLength(3);
    expect(rows.slice(1).every((row) => row[statusColumn] === "Missing" && row[scoreColumn] === 0)).toBe(true);
  });
});
