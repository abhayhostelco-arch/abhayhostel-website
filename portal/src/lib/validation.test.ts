import { describe, expect, it } from "vitest";
import {
  alertSettingsSchema,
  changePasswordSchema,
  createAccountSchema,
  dailyEntrySchema,
  flattenErrors,
  loginSchema,
  passwordSchema,
  reportQuerySchema,
  targetAccountSchema,
} from "@/lib/validation";

describe("password validation", () => {
  it("requires length and every character group", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("LongButNoNumber!xx").success).toBe(false);
    expect(passwordSchema.safeParse("StrongPassword9!").success).toBe(true);
  });
});

describe("daily entry validation", () => {
  it("accepts allowlisted values and trims an empty note", () => {
    const result = dailyEntrySchema.parse({
      entryDate: "2026-08-22",
      sleepTime: "22:30",
      wakeTime: "06:15",
      studyHours: "4",
      studyMinutes: "30",
      academyStatus: "present",
      note: "   ",
    });
    expect(result.note).toBeNull();
  });

  it("rejects invalid times, enums, study duration, and long notes", () => {
    expect(dailyEntrySchema.safeParse({
      entryDate: "2026-08-22",
      sleepTime: "25:00",
      wakeTime: "06:00",
      studyHours: 19,
      studyMinutes: 0,
      academyStatus: "holiday",
      note: "x".repeat(501),
    }).success).toBe(false);
  });
});

describe("settings and report input", () => {
  it("requires ordered sleep limits", () => {
    expect(alertSettingsSchema.safeParse({
      missedEntryEnabled: true,
      sleepAlertEnabled: true,
      minSleepMinutes: 700,
      maxSleepMinutes: 600,
      studyAlertEnabled: true,
      minStudyMinutes: 240,
      absenceAlertEnabled: true,
    }).success).toBe(false);
  });

  it("accepts only capped report ranges and UUID filters", () => {
    expect(reportQuerySchema.parse({ range: "90" }).range).toBe("90");
    expect(reportQuerySchema.safeParse({ range: "365" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ range: "30", studentId: "x' OR 1=1--" }).success).toBe(false);
  });
});

describe("account inputs", () => {
  it("normalizes account and login fields", () => {
    const account = createAccountSchema.parse({
      role: "student",
      fullName: " Student Name ",
      email: "STUDENT@EXAMPLE.COM",
      phone: " ",
      academyLabel: " Class 12 ",
      joinedOn: "2026-01-01",
    });
    expect(account.email).toBe("student@example.com");
    expect(account.phone).toBeNull();
    expect(account.academyLabel).toBe("Class 12");
    expect(loginSchema.parse({ email: "A@EXAMPLE.COM", password: "x" }).email).toBe("a@example.com");
  });

  it("checks matching passwords and boolean targets", () => {
    expect(changePasswordSchema.safeParse({
      password: "StrongPassword9!",
      confirmPassword: "DifferentPassword9!",
    }).success).toBe(false);
    expect(targetAccountSchema.parse({
      targetId: "00000000-0000-4000-8000-000000000001",
      active: "true",
    }).active).toBe(true);
  });

  it("flattens field errors for action responses", () => {
    const result = createAccountSchema.safeParse({ role: "admin", fullName: "x", email: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) expect(flattenErrors(result.error).email).toBeDefined();
  });
});
