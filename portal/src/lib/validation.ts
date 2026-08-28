import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(14, "Use at least 14 characters.")
  .max(128, "Password is too long.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.")
  .regex(/[^A-Za-z0-9]/, "Add a symbol.");

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
  captchaToken: z.string().min(1).max(4096),
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
  captchaToken: z.string().min(1).max(4096),
});

export const changePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .optional();

export const createAccountSchema = z.object({
  role: z.enum(["admin", "student"]),
  fullName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  phone: optionalText(30),
  academyLabel: optionalText(120),
  joinedOn: z.iso.date().optional(),
  mentorId: z.uuid().optional(),
});

export const assignMentorSchema = z.object({ studentId: z.uuid(), mentorId: z.uuid() });

export const targetAccountSchema = z.object({
  targetId: z.uuid(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const resetAccountSchema = z.object({ targetId: z.uuid() });

export const dailyEntrySchema = z.object({
  entryDate: z.iso.date(),
  sleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  studyHours: z.coerce.number().int().min(0).max(18),
  studyMinutes: z.coerce.number().int().min(0).max(59),
  chantingRounds: z.preprocess(
    (value) => value === null || value === "" ? undefined : value,
    z.coerce.number().int().min(0).max(108),
  ),
  gitaClassStatus: z.enum(["present", "absent", "no_class"]),
  morningAratiAttended: z.boolean(),
  eveningReadingMinutes: z.coerce.number().int().min(0).max(360),
  libraryAttended: z.boolean(),
  sevaMinutes: z.coerce.number().int().min(0).max(720),
  note: z.string().trim().max(500).transform((value) => value || null),
});

export const scoreSettingsSchema = z
  .object({
    sadhanaWeight: z.coerce.number().int().min(0).max(100),
    studyWeight: z.coerce.number().int().min(0).max(100),
    disciplineWeight: z.coerce.number().int().min(0).max(100),
    sevaWeight: z.coerce.number().int().min(0).max(100),
    chantingTargetRounds: z.coerce.number().int().min(1).max(108),
    eveningReadingTargetMinutes: z.coerce.number().int().min(1).max(360),
    studyTargetMinutes: z.coerce.number().int().min(1).max(1080),
    wakeTargetTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    bedtimeTargetTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    sevaTargetMinutes: z.coerce.number().int().min(1).max(720),
    disciplineGraceMinutes: z.coerce.number().int().min(1).max(360),
    scoreStartDate: z.iso.date(),
  })
  .refine(
    (value) => value.sadhanaWeight + value.studyWeight + value.disciplineWeight + value.sevaWeight === 100,
    { message: "Category weights must total 100.", path: ["sadhanaWeight"] },
  );

export const alertSettingsSchema = z
  .object({
    missedEntryEnabled: z.boolean(),
    sleepAlertEnabled: z.boolean(),
    minSleepMinutes: z.coerce.number().int().min(60).max(900),
    maxSleepMinutes: z.coerce.number().int().min(120).max(960),
    studyAlertEnabled: z.boolean(),
    minStudyMinutes: z.coerce.number().int().min(0).max(1080),
    absenceAlertEnabled: z.boolean(),
  })
  .refine((value) => value.minSleepMinutes < value.maxSleepMinutes, {
    message: "Minimum sleep must be below maximum sleep.",
    path: ["minSleepMinutes"],
  });

export const reportQuerySchema = z.object({
  range: z.enum(["7", "30", "90"]).default("30"),
  studentId: z.uuid().optional(),
});

const safeUrl = z.url().max(2048).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Use an HTTP or HTTPS link.");
export const resourceSchema = z.object({
  resourceId: z.uuid().optional(), title: z.string().trim().min(2).max(160),
  url: safeUrl, category: optionalText(80), published: z.boolean(),
});
export const weeklyProgramSchema = z.object({ programDate: z.iso.date() });
export const weeklyEntrySchema = z.object({
  programId: z.uuid(), attendance: z.enum(["present", "absent"]), woreDhotiKurta: z.boolean(),
});
export const attendancePersonSchema = z.object({
  name: z.string().trim().min(2).max(120), phone: optionalText(30), notes: optionalText(500), profileId: z.uuid().optional(),
});
export const attendanceEventSchema = z.object({
  name: z.string().trim().min(2).max(120),
  statuses: z.string().transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean)).pipe(z.array(z.string().min(1).max(40)).min(1).max(8)),
});
export const attendanceRecordSchema = z.object({
  eventId: z.uuid(), personId: z.uuid(), attendanceDate: z.iso.date(), status: z.string().trim().min(1).max(40), remark: optionalText(300),
});

export const optionalBirthDateSchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.iso.date().optional(),
);

export const avatarUploadSchema = z.object({
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(2 * 1024 * 1024),
});

export const avatarPathSchema = z.string().max(240).regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/avatar-[0-9]+\.(?:jpg|jpeg|png|webp)$/i,
  "Invalid avatar path.",
);

export const gitaAttendanceDateSchema = z.iso.date();
export const gitaAttendanceStatusSchema = z.enum(["present", "absent", "no_class"]);

export function flattenErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}
