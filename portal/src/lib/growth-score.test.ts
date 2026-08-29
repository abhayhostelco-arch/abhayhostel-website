import { describe, expect, it } from "vitest";
import { buildGrowthReport, buildWeeklyCategorySeries, scoreDailyEntry } from "@/lib/growth-score";
import type { DailyEntry, Profile, ScoreSettings } from "@/lib/types";

const settings: ScoreSettings = {
  id: true, sadhana_weight: 40, study_weight: 25, discipline_weight: 20, seva_weight: 15,
  chanting_target_rounds: 16, evening_reading_target_minutes: 30, study_target_minutes: 240,
  wake_target_time: "06:00:00", bedtime_target_time: "22:30:00", seva_target_minutes: 60,
  discipline_grace_minutes: 120, score_start_date: "2026-08-20", updated_by: null, updated_at: "2026-08-20T00:00:00Z",
};

const student = (id: string, name: string): Profile => ({
  id, role: "student", full_name: name, email: `${name.toLowerCase()}@example.com`, phone: null,
  academy_label: null, joined_on: "2026-01-01", is_active: true, must_change_password: false,
  created_by: null, mentor_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});

const entry = (studentId: string, overrides: Partial<DailyEntry> = {}): DailyEntry => ({
  id: crypto.randomUUID(), student_id: studentId, entry_date: "2026-08-22", sleep_time: "22:30:00",
  wake_time: "06:00:00", study_minutes: 240, chanting_rounds: 16, gita_class_status: "present",
  morning_arati_attended: true, evening_reading_minutes: 30, library_attended: true, seva_minutes: 60,
  note: null, created_at: "2026-08-22T00:00:00Z", updated_at: "2026-08-22T00:00:00Z", ...overrides,
});

describe("Growth Score", () => {
  it("awards 100 for meeting every target and caps proportional components", () => {
    expect(scoreDailyEntry(entry("a", { study_minutes: 600, chanting_rounds: 108, seva_minutes: 300 }), settings)).toEqual({ sadhana: 100, study: 100, discipline: 100, seva: 100, overall: 100 });
  });

  it("normalizes Sadhana when there is no Gita class", () => {
    expect(scoreDailyEntry(entry("a", { gita_class_status: "no_class" }), settings).sadhana).toBe(100);
  });

  it("does not award Morning Arati credit for a late status", () => {
    const late = scoreDailyEntry(entry("a", { morning_arati_attended: true, morning_arati_status: "late" }), settings);
    const present = scoreDailyEntry(entry("a", { morning_arati_attended: false, morning_arati_status: "present" }), settings);
    expect(late.sadhana).toBe(75);
    expect(present.sadhana).toBe(100);
  });

  it("applies a linear discipline grace period", () => {
    const result = scoreDailyEntry(entry("a", { wake_time: "07:00:00", sleep_time: "23:30:00" }), settings);
    expect(result.discipline).toBe(50);
  });

  it("counts missing eligible days as zero and excludes pre-launch dates", () => {
    const report = buildGrowthReport([student("a", "Alpha")], [entry("a")], settings, 7, new Date("2026-08-22T06:30:00Z"));
    expect(report.students[0].eligibleDays).toBe(3);
    expect(report.students[0].submittedDays).toBe(1);
    expect(Math.round(report.students[0].overall)).toBe(33);
  });

  it("uses unique ranks and alphabetical ordering for displayed-score ties while excluding inactive students", () => {
    const inactive = { ...student("c", "Charlie"), is_active: false };
    const report = buildGrowthReport([student("a", "Alpha"), student("b", "Beta"), inactive], [entry("a"), entry("b")], { ...settings, score_start_date: "2026-08-22" }, 1, new Date("2026-08-22T06:30:00Z"));
    expect(report.students.map((value) => value.rank)).toEqual([1, 2]);
    expect(report.students.map((value) => value.studentName)).toEqual(["Alpha", "Beta"]);
    expect(report.students.map((value) => value.studentName)).not.toContain("Charlie");
  });

  it("supports a top-ten rolling leaderboard while retaining global ranks", () => {
    const students = Array.from({ length: 12 }, (_, index) => student(String(index), `Student ${String(index).padStart(2, "0")}`));
    const entries = students.map((value, index) => entry(value.id, { chanting_rounds: Math.max(0, 16 - index) }));
    const report = buildGrowthReport(students, entries, { ...settings, score_start_date: "2026-08-22" }, 7, new Date("2026-08-22T06:30:00Z"));
    expect(report.students.slice(0, 10)).toHaveLength(10);
    expect(report.students[10].rank).toBeGreaterThanOrEqual(10);
  });

  it("builds weekly category points for a selected student or the group average", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha"), student("b", "Beta")],
      [entry("a"), entry("b", { chanting_rounds: 0, morning_arati_attended: false, morning_arati_status: "absent", gita_class_status: "absent", evening_reading_minutes: 0 })],
      { ...settings, score_start_date: "2026-08-22" }, 7, new Date("2026-08-22T06:30:00Z"),
    );
    expect(buildWeeklyCategorySeries(report, "a")).toEqual([{ date: "08-22", sadhana: 100, study: 100, discipline: 100, seva: 100 }]);
    expect(buildWeeklyCategorySeries(report)).toEqual([{ date: "08-22", sadhana: 50, study: 100, discipline: 100, seva: 100 }]);
  });
});
