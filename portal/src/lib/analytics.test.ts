import { describe, expect, it } from "vitest";
import {
  average,
  averageClock,
  deriveAlerts,
  formatClock,
  formatMinutes,
  sleepDurationMinutes,
  timeToMinutes,
  total,
  totalRecorded,
} from "@/lib/analytics";
import type { AlertSettings, DailyEntry, Profile } from "@/lib/types";

const student: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "student",
  full_name: "Test Student",
  email: "student@example.com",
  phone: null,
  academy_label: "Class 12",
  joined_on: "2026-01-01",
  is_active: true,
  must_change_password: false,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const settings: AlertSettings = {
  id: true,
  missed_entry_enabled: true,
  sleep_alert_enabled: true,
  min_sleep_minutes: 360,
  max_sleep_minutes: 600,
  study_alert_enabled: true,
  min_study_minutes: 240,
  absence_alert_enabled: true,
  updated_by: null,
  updated_at: "2026-01-01T00:00:00Z",
};

function entry(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    student_id: student.id,
    entry_date: "2026-08-21",
    sleep_time: "23:00:00",
    wake_time: "05:00:00",
    study_minutes: 180,
    chanting_rounds: 16,
    gita_class_status: "absent",
    morning_arati_attended: true,
    evening_reading_minutes: 30,
    library_attended: true,
    seva_minutes: 60,
    note: null,
    created_at: "2026-08-21T00:00:00Z",
    updated_at: "2026-08-21T00:00:00Z",
    ...overrides,
  };
}

describe("sleep and averages", () => {
  it("calculates an overnight sleep duration", () => {
    expect(sleepDurationMinutes("22:30", "06:15")).toBe(465);
  });

  it("handles empty and overnight clock averages safely", () => {
    expect(average([])).toBeNull();
    expect(average([120, 240])).toBe(180);
    expect(averageClock(["23:00", "01:00"], true)).toBe(0);
    expect(averageClock([])).toBeNull();
    expect(timeToMinutes("06:30:00")).toBe(390);
    expect(formatMinutes(null)).toBe("—");
    expect(formatMinutes(125)).toBe("2h 05m");
    expect(formatClock(null)).toBe("—");
    expect(formatClock(390)).toContain("6:30");
    expect(total([60, 90, 30])).toBe(180);
    expect(totalRecorded([16, null, 8])).toBe(24);
    expect(totalRecorded([null])).toBeNull();
  });
});

describe("derived alerts", () => {
  it("derives missing, study, and absence alerts from current records", () => {
    const alerts = deriveAlerts(
      [student],
      [entry()],
      settings,
      2,
      new Date("2026-08-22T06:30:00Z"),
    );
    expect(alerts.map((alert) => alert.type)).toEqual(expect.arrayContaining(["missing", "study", "absence"]));
    expect(alerts.some((alert) => alert.type === "sleep")).toBe(false);
  });

  it("excludes deactivated students", () => {
    expect(deriveAlerts([{ ...student, is_active: false }], [], settings, 7)).toEqual([]);
  });

  it("derives a sleep alert outside configured bounds", () => {
    const alerts = deriveAlerts(
      [student],
      [entry({ sleep_time: "02:00:00", wake_time: "05:00:00", study_minutes: 300, gita_class_status: "present" })],
      { ...settings, missed_entry_enabled: false },
      2,
      new Date("2026-08-22T06:30:00Z"),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("sleep");
  });
});
