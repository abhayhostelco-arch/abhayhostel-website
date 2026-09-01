import { describe, expect, it } from "vitest";
import { buildGrowthReport, buildWeeklyCategorySeries, scoreDailyEntry } from "@/lib/growth-score";
import type { DailyEntry, Profile, ScoreSettings } from "@/lib/types";

const settings: ScoreSettings = {
  id: true, sadhana_weight: 40, study_weight: 25, discipline_weight: 20, seva_weight: 15,
  chanting_target_rounds: 16, evening_reading_target_minutes: 90, study_target_minutes: 240,
  wake_target_time: "06:00:00", bedtime_target_time: "22:30:00", seva_target_minutes: 60,
  discipline_grace_minutes: 120, score_start_date: "2026-01-01", updated_by: null, updated_at: "2026-08-20T00:00:00Z",
};

const student = (id: string, name: string, overrides: Partial<Profile> = {}): Profile => ({
  id, role: "student", full_name: name, email: `${name.toLowerCase()}@example.com`, phone: null,
  academy_label: null, joined_on: "2026-01-01", is_active: true, must_change_password: false,
  created_by: null, mentor_id: null, student_group: "abhay_hostel", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const entry = (studentId: string, overrides: Partial<DailyEntry> = {}): DailyEntry => ({
  id: crypto.randomUUID(), student_id: studentId, entry_date: "2026-08-22", sleep_time: "22:00:00",
  wake_time: "05:00:00", study_minutes: 360, chanting_rounds: 2, gita_class_status: "present",
  morning_arati_attended: true, morning_arati_status: "present", evening_reading_minutes: 30,
  library_attended: false, seva_minutes: 0, note: null, created_at: "2026-08-22T00:00:00Z",
  updated_at: "2026-08-22T00:00:00Z", ...overrides,
});

describe("fixed daily Growth Score formula", () => {
  it("equally averages fixed Sadhana components and excludes a no-class Gita component", () => {
    const scored = scoreDailyEntry(entry("a", { chanting_rounds: 1, morning_arati_status: "late", gita_class_status: "present", evening_reading_minutes: 15 }), settings, 80);
    const noClass = scoreDailyEntry(entry("a", { chanting_rounds: 1, morning_arati_status: "absent", gita_class_status: "no_class", evening_reading_minutes: 15 }), settings, 80);

    expect(scored.sadhana).toBe(50);
    expect(noClass.sadhana).toBeCloseTo(100 / 3);
  });

  it("scores Study against six hours without a library bonus and caps it at 100", () => {
    expect(scoreDailyEntry(entry("a", { study_minutes: 180, library_attended: true }), settings, 0).study).toBe(50);
    expect(scoreDailyEntry(entry("a", { study_minutes: 720, library_attended: false }), settings, 0).study).toBe(100);
  });

  it("deducts five Discipline points for every started 30-minute late interval", () => {
    expect(scoreDailyEntry(entry("a", { sleep_time: "22:00:00", wake_time: "05:00:00" }), settings, 0).discipline).toBe(50);
    expect(scoreDailyEntry(entry("a", { sleep_time: "22:01:00", wake_time: "05:30:00" }), settings, 0).discipline).toBe(40);
    expect(scoreDailyEntry(entry("a", { sleep_time: "22:30:00", wake_time: "05:31:00" }), settings, 0).discipline).toBe(35);
    expect(scoreDailyEntry(entry("a", { sleep_time: "03:00:00", wake_time: "08:00:00" }), settings, 0).discipline).toBe(0);
  });

  it("uses equal category weighting and retains unrounded internal scores", () => {
    const scored = scoreDailyEntry(entry("a", { study_minutes: 1 }), settings, 80);

    expect(scored.study).toBeCloseTo(100 / 360);
    expect(scored.overall).toBeCloseTo((100 + (100 / 360) + 50 + 80) / 4);
  });
});

describe("weekly Seva Growth Score", () => {
  it("uses entries from the complete intersecting week without prorating at the report boundary", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha")],
      [entry("a", { entry_date: "2026-08-17", seva_minutes: 90 }), entry("a", { entry_date: "2026-08-19", seva_minutes: 0 })],
      settings, 7, new Date("2026-08-25T06:30:00Z"),
    );

    expect(report.dates[0]).toBe("2026-08-19");
    expect(report.students[0].daily[0].seva).toBe(50);
  });

  it("uses the complete week after a historical report-end boundary", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha")],
      [entry("a", { entry_date: "2026-08-19", seva_minutes: 0 }), entry("a", { entry_date: "2026-08-23", seva_minutes: 90 })],
      settings, 1, new Date("2026-08-30T06:30:00Z"), "2026-08-19",
    );

    expect(report.dates).toEqual(["2026-08-19"]);
    expect(report.students[0].daily[0].seva).toBe(50);
  });

  it("prorates a past joining week by its five eligible days", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha", { joined_on: "2026-08-19" })],
      [entry("a", { entry_date: "2026-08-19", seva_minutes: 90 })],
      settings, 12, new Date("2026-08-30T06:30:00Z"),
    );

    expect(report.students[0].daily[0].seva).toBe(70);
  });

  it("prorates a past scoring-start week by its four eligible days", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha")],
      [entry("a", { entry_date: "2026-08-20", seva_minutes: 90 })],
      { ...settings, score_start_date: "2026-08-20" }, 11, new Date("2026-08-30T06:30:00Z"),
    );

    expect(report.students[0].daily[0].seva).toBe(87.5);
  });

  it("prorates the current incomplete week through today in India", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha")],
      [entry("a", { entry_date: "2026-08-26", seva_minutes: 45 })],
      settings, 1, new Date("2026-08-26T06:30:00Z"),
    );

    expect(report.students[0].daily[0].seva).toBeCloseTo(175 / 3);
  });

  it("keeps every category zero on a missing eligible daily-entry date", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha")],
      [entry("a", { entry_date: "2026-08-17", seva_minutes: 60 })],
      settings, 2, new Date("2026-08-18T06:30:00Z"),
    );

    expect(report.students[0].daily[1]).toEqual({ date: "2026-08-18", submitted: false, sadhana: 0, study: 0, discipline: 0, seva: 0, overall: 0 });
    expect(report.students[0]).toMatchObject({ eligibleDays: 2, submittedDays: 1, sadhana: 50, study: 50, discipline: 25, seva: 50, overall: 43.75 });
  });
});

describe("Growth Score reporting", () => {
  it("excludes pre-launch dates", () => {
    const report = buildGrowthReport([student("a", "Alpha")], [entry("a")], { ...settings, score_start_date: "2026-08-20" }, 7, new Date("2026-08-22T06:30:00Z"));
    expect(report.students[0].eligibleDays).toBe(3);
    expect(report.students[0].submittedDays).toBe(1);
  });

  it("uses unique same-group ranks with case-insensitive name and student-ID tiebreaks", () => {
    const inactive = { ...student("c", "Charlie"), is_active: false };
    const report = buildGrowthReport(
      [student("b", "alpha"), student("a", "Alpha"), student("d", "Beta"), inactive],
      [entry("a"), entry("b"), entry("d")],
      { ...settings, score_start_date: "2026-08-22" }, 1, new Date("2026-08-22T06:30:00Z"),
    );

    expect(report.students.map((value) => [value.studentId, value.rank])).toEqual([["a", 1], ["b", 2], ["d", 3]]);
    expect(report.students.map((value) => value.studentName)).not.toContain("Charlie");
  });

  it("partitions ranks by hostel group after receiving the audience cohort", () => {
    const report = buildGrowthReport(
      [
        student("abhay-low", "Abhay Low", { student_group: "abhay_hostel" }),
        student("krishna-high", "Krishna High", { student_group: "krishna_home" }),
        student("abhay-high", "Abhay High", { student_group: "abhay_hostel" }),
      ],
      [
        entry("abhay-low", { study_minutes: 100 }),
        entry("krishna-high", { study_minutes: 360 }),
        entry("abhay-high", { study_minutes: 200 }),
      ],
      { ...settings, score_start_date: "2026-08-22" }, 1, new Date("2026-08-22T06:30:00Z"),
    );

    expect(report.students.map((value) => [value.studentId, value.studentGroup, value.rank])).toEqual([
      ["abhay-high", "abhay_hostel", 1],
      ["abhay-low", "abhay_hostel", 2],
      ["krishna-high", "krishna_home", 1],
    ]);
  });

  it("orders distinct internal scores before presentation rounding", () => {
    const report = buildGrowthReport(
      [student("a", "Alpha"), student("z", "Zulu")],
      [entry("a", { study_minutes: 180 }), entry("z", { study_minutes: 181 })],
      { ...settings, score_start_date: "2026-08-22" }, 1, new Date("2026-08-22T06:30:00Z"),
    );

    expect(report.students.map((value) => value.studentName)).toEqual(["Zulu", "Alpha"]);
    expect(Math.round(report.students[0].overall)).toBe(Math.round(report.students[1].overall));
  });

  it("supports a top-ten rolling leaderboard while retaining global ranks", () => {
    const students = Array.from({ length: 12 }, (_, index) => student(String(index), `Student ${String(index).padStart(2, "0")}`));
    const entries = students.map((value, index) => entry(value.id, { chanting_rounds: Math.max(0, 2 - index) }));
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
    expect(buildWeeklyCategorySeries(report, "a")).toEqual([{ date: "08-22", sadhana: 100, study: 100, discipline: 50, seva: 0 }]);
    expect(buildWeeklyCategorySeries(report)).toEqual([{ date: "08-22", sadhana: 50, study: 100, discipline: 50, seva: 0 }]);
  });
});
