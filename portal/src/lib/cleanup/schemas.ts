import { z } from "zod";

export const cleanupRunIdSchema = z.uuid();
export const cleanupToggleSchema = z.object({ enabled: z.boolean() });
export const historicalCleanupSchema = z.object({
  retentionDays: z.coerce.number().int().refine((value) => [90, 180, 365].includes(value), "Choose a supported retention period."),
  categories: z.array(z.enum([
    "daily_entries", "gita_attendance", "weekly_programs", "attendance_records",
    "completed_leaves", "archived_resources", "orphan_files",
  ])).min(1, "Choose at least one category."),
});
