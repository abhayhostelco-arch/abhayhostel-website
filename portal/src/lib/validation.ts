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
});

export const targetAccountSchema = z.object({
  targetId: z.uuid(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const resetAccountSchema = z.object({ targetId: z.uuid() });

export const reauthenticateSchema = z.object({
  password: z.string().min(1).max(128),
});

export const dailyEntrySchema = z.object({
  entryDate: z.iso.date(),
  sleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  studyHours: z.coerce.number().int().min(0).max(18),
  studyMinutes: z.coerce.number().int().min(0).max(59),
  academyStatus: z.enum(["present", "absent", "no_class"]),
  note: z.string().trim().max(500).transform((value) => value || null),
});

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

export function flattenErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}
