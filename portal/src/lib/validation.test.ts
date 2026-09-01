import { describe, expect, it } from "vitest";
import {
  alertSettingsSchema,
  changePasswordSchema,
  createAccountSchema,
  dailyEntrySchema,
  flattenErrors,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  reportQuerySchema,
  scoreSettingsSchema,
  targetAccountSchema,
  studentGroupActionSchema,
  optionalBirthDateSchema,
  avatarPathSchema,
  avatarUploadSchema,
} from "@/lib/validation";
import * as validation from "@/lib/validation";

describe("password validation", () => {
  it("requires length and every character group", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("LongButNoNumber!xx").success).toBe(false);
    expect(passwordSchema.safeParse("StrongPassword9!").success).toBe(true);
  });
});

describe("profile enhancements", () => {
  it("accepts an optional birthdate and rejects malformed values", () => {
    expect(optionalBirthDateSchema.parse("")).toBeUndefined();
    expect(optionalBirthDateSchema.parse("2005-01-20")).toBe("2005-01-20");
    expect(optionalBirthDateSchema.safeParse("20/01/2005").success).toBe(false);
  });

  it("allows only safe avatar types, sizes, and owned-path shapes", () => {
    expect(avatarUploadSchema.safeParse({ type: "image/webp", size: 1024 }).success).toBe(true);
    expect(avatarUploadSchema.safeParse({ type: "image/svg+xml", size: 1024 }).success).toBe(false);
    expect(avatarUploadSchema.safeParse({ type: "image/png", size: 2 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(avatarPathSchema.safeParse("00000000-0000-4000-8000-000000000001/avatar-1724800000000.png").success).toBe(true);
    expect(avatarPathSchema.safeParse("../someone/avatar.png").success).toBe(false);
  });
});

describe("daily entry validation", () => {
  it("accepts Morning Arati statuses and requires an owned Maha Mantra path when needed", () => {
    const base = {
      entryDate: "2026-08-22", sleepTime: "22:30", wakeTime: "06:00", studyHours: 4,
      studyMinutes: 0, chantingRounds: 16, gitaClassStatus: "present",
      eveningReadingMinutes: 30, libraryAttended: true, sevaMinutes: 60, note: "",
    };
    const ownedPath = "00000000-0000-4000-8000-000000000001/2026-08-22/maha-mantra-1724800000000.png";
    expect(dailyEntrySchema.safeParse({ ...base, morningAratiStatus: "present", mahaMantraPath: "" }).success).toBe(true);
    expect(dailyEntrySchema.safeParse({ ...base, morningAratiStatus: "late", mahaMantraPath: ownedPath }).success).toBe(true);
    expect(dailyEntrySchema.safeParse({ ...base, morningAratiStatus: "absent", mahaMantraPath: "" }).success).toBe(false);
    expect(dailyEntrySchema.safeParse({ ...base, morningAratiStatus: "excused", mahaMantraPath: ownedPath }).success).toBe(false);
  });

  it("allows an authorized staff correction without historical evidence", () => {
    const schema = (validation as unknown as { staffDailyEntrySchema: { safeParse: (value: unknown) => { success: boolean } } }).staffDailyEntrySchema;
    expect(schema.safeParse({
      entryDate: "2026-08-22", sleepTime: "22:30", wakeTime: "06:00", studyHours: 4,
      studyMinutes: 0, chantingRounds: 16, gitaClassStatus: "present", morningAratiStatus: "absent",
      mahaMantraPath: "", eveningReadingMinutes: 30, libraryAttended: true, sevaMinutes: 60, note: "",
    }).success).toBe(true);
  });

  it("accepts allowlisted values and trims an empty note", () => {
    const result = dailyEntrySchema.parse({
      entryDate: "2026-08-22",
      sleepTime: "22:30",
      wakeTime: "06:15",
      studyHours: "4",
      studyMinutes: "30",
      chantingRounds: "16",
      gitaClassStatus: "present",
      morningAratiAttended: true,
      eveningReadingMinutes: 30,
      libraryAttended: true,
      sevaMinutes: 60,
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
      chantingRounds: 109,
      gitaClassStatus: "holiday",
      note: "x".repeat(501),
    }).success).toBe(false);
  });

  it("requires whole chanting rounds between 0 and 108", () => {
    const validEntry = {
      entryDate: "2026-08-22",
      sleepTime: "22:30",
      wakeTime: "06:00",
      studyHours: 4,
      studyMinutes: 0,
      gitaClassStatus: "present",
      morningAratiAttended: true,
      eveningReadingMinutes: 30,
      libraryAttended: true,
      sevaMinutes: 60,
      note: "",
    };
    expect(dailyEntrySchema.safeParse({ ...validEntry, chantingRounds: 0 }).success).toBe(true);
    expect(dailyEntrySchema.safeParse({ ...validEntry, chantingRounds: 108 }).success).toBe(true);
    expect(dailyEntrySchema.safeParse({ ...validEntry, chantingRounds: "" }).success).toBe(false);
    expect(dailyEntrySchema.safeParse({ ...validEntry, chantingRounds: 1.5 }).success).toBe(false);
    expect(dailyEntrySchema.safeParse({ ...validEntry, chantingRounds: -1 }).success).toBe(false);
    expect(dailyEntrySchema.safeParse({ ...validEntry, chantingRounds: 109 }).success).toBe(false);
  });

  it("rejects negative or oversized scoring activity values", () => {
    const base = {
      entryDate: "2026-08-22", sleepTime: "22:30", wakeTime: "06:00", studyHours: 4,
      studyMinutes: 0, chantingRounds: 16, gitaClassStatus: "present", morningAratiAttended: true,
      eveningReadingMinutes: 30, libraryAttended: true, sevaMinutes: 60, note: "",
    };
    expect(dailyEntrySchema.safeParse({ ...base, eveningReadingMinutes: -1 }).success).toBe(false);
    expect(dailyEntrySchema.safeParse({ ...base, sevaMinutes: 721 }).success).toBe(false);
  });
});

describe("leave request validation", () => {
  it("accepts an ordered date range and normalizes an empty attachment", () => {
    const schema = (validation as unknown as { leaveRequestSchema: { safeParse: (value: unknown) => { success: boolean } } }).leaveRequestSchema;
    expect(schema.safeParse({ requestId: "00000000-0000-4000-8000-000000000010", startDate: "2026-09-01", endDate: "2026-09-03", reason: "Family visit", attachmentPath: "" }).success).toBe(true);
  });

  it("rejects reversed dates, short reasons, and malformed attachments", () => {
    const schema = (validation as unknown as { leaveRequestSchema: { safeParse: (value: unknown) => { success: boolean } } }).leaveRequestSchema;
    expect(schema.safeParse({ requestId: "00000000-0000-4000-8000-000000000010", startDate: "2026-09-03", endDate: "2026-09-01", reason: "x", attachmentPath: "../secret.pdf" }).success).toBe(false);
  });

  it("requires a reason when Admin rejects a request", () => {
    const schema = (validation as unknown as { leaveDecisionSchema: { safeParse: (value: unknown) => { success: boolean } } }).leaveDecisionSchema;
    const requestId = "00000000-0000-4000-8000-000000000010";
    expect(schema.safeParse({ requestId, expectedStatus: "pending", decision: "approved", decisionNote: "" }).success).toBe(true);
    expect(schema.safeParse({ requestId, expectedStatus: "pending", decision: "rejected", decisionNote: "" }).success).toBe(false);
    expect(schema.safeParse({ requestId, expectedStatus: "pending", decision: "withdrawn", decisionNote: "Changed plans" }).success).toBe(false);
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
    expect(reportQuerySchema.parse({}).range).toBe("30");
    expect(reportQuerySchema.parse({ range: "90" }).range).toBe("90");
    expect(reportQuerySchema.safeParse({ range: "365" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ range: "30", studentId: "x' OR 1=1--" }).success).toBe(false);
    expect(reportQuerySchema.parse({ range: "30", group: "krishna_home" }).group).toBe("krishna_home");
    expect(reportQuerySchema.safeParse({ range: "30", group: "other" }).success).toBe(false);
  });

  it("requires Growth Score category weights to total 100", () => {
    const valid = {
      sadhanaWeight: 40, studyWeight: 25, disciplineWeight: 20, sevaWeight: 15,
      chantingTargetRounds: 16, eveningReadingTargetMinutes: 30, studyTargetMinutes: 240,
      wakeTargetTime: "06:00", bedtimeTargetTime: "22:30", sevaTargetMinutes: 60,
      disciplineGraceMinutes: 120, scoreStartDate: "2026-08-22",
    };
    expect(scoreSettingsSchema.safeParse(valid).success).toBe(true);
    expect(scoreSettingsSchema.safeParse({ ...valid, studyWeight: 30 }).success).toBe(false);
  });
});

describe("account inputs", () => {
  it("requires an explicit allowlisted group for Student accounts only", () => {
    const student = {
      role: "student",
      fullName: "Student Name",
      email: "student@example.com",
      joinedOn: "2026-01-01",
      mentorId: "00000000-0000-4000-8000-000000000002",
    };

    expect(createAccountSchema.safeParse(student).success).toBe(false);
    expect(createAccountSchema.safeParse({ ...student, studentGroup: "abhay_hostel" }).success).toBe(true);
    expect(createAccountSchema.safeParse({ ...student, studentGroup: "krishna_home" }).success).toBe(true);
    expect(createAccountSchema.safeParse({ ...student, studentGroup: "other" }).success).toBe(false);
    expect(createAccountSchema.safeParse({ role: "admin", fullName: "Mentor Name", email: "mentor@example.com" }).success).toBe(true);
  });

  it("validates the target and group for Student group changes", () => {
    const input = { targetId: "00000000-0000-4000-8000-000000000001", studentGroup: "krishna_home" };
    expect(studentGroupActionSchema.safeParse(input).success).toBe(true);
    expect(studentGroupActionSchema.safeParse({ ...input, studentGroup: "other" }).success).toBe(false);
    expect(studentGroupActionSchema.safeParse({ ...input, targetId: "not-a-uuid" }).success).toBe(false);
  });

  it("normalizes account and login fields", () => {
    const account = createAccountSchema.parse({
      role: "student",
      fullName: " Student Name ",
      email: "STUDENT@EXAMPLE.COM",
      phone: " ",
      academyLabel: " Class 12 ",
      joinedOn: "2026-01-01",
      studentGroup: "abhay_hostel",
    });
    expect(account.email).toBe("student@example.com");
    expect(account.phone).toBeNull();
    expect(account.academyLabel).toBe("Class 12");
    expect(loginSchema.parse({
      email: "A@EXAMPLE.COM",
      password: "x",
      captchaToken: "verified-token",
    }).email).toBe("a@example.com");
  });

  it("requires a CAPTCHA token for authentication requests", () => {
    expect(loginSchema.safeParse({
      email: "a@example.com",
      password: "x",
    }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({
      email: "a@example.com",
    }).success).toBe(false);
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
