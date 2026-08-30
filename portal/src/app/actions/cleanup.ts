"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { invokeCleanupWorker } from "@/lib/cleanup/netlify";
import { cleanupRunIdSchema, historicalCleanupSchema } from "@/lib/cleanup/schemas";
import { isMissingCleanupSchemaError } from "@/lib/schema-compat";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";

const unavailable = "Data maintenance is unavailable until the maintenance migration has been applied.";

async function dispatch(runId: string): Promise<void> {
  await invokeCleanupWorker(runId);
}

export async function updateAutoCleanupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const enabled = formData.get("automaticEnabled") === "on";
  const { error } = await createAdminClient().rpc("cleanup_update_auto", { p_actor_uuid: actor.id, p_enabled_boolean: enabled });
  if (error) return { status: "error", message: isMissingCleanupSchemaError(error) ? unavailable : "Automatic cleanup could not be updated." };
  revalidatePath("/admin/profile");
  return { status: "success", message: enabled ? "Automatic cleanup enabled." : "Automatic cleanup disabled." };
}

export async function previewHistoricalCleanupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = historicalCleanupSchema.safeParse({ retentionDays: formData.get("retentionDays"), categories: formData.getAll("categories") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Choose cleanup options." };
  const { error } = await createAdminClient().rpc("cleanup_preview_history", {
    p_actor_uuid: actor.id, p_retention_days: parsed.data.retentionDays, p_categories: parsed.data.categories,
  });
  if (error) {
    console.error("Cleanup preview RPC failed", { code: error.code, message: error.message, details: error.details });
    return {
      status: "error",
      message: isMissingCleanupSchemaError(error)
        ? unavailable
        : `The cleanup preview could not be created (${error.code ?? "unknown"}): ${error.message}`,
    };
  }
  revalidatePath("/admin/profile");
  return { status: "success", message: "Preview created. Review it below before confirming deletion." };
}

export async function confirmCleanupPreviewAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = cleanupRunIdSchema.safeParse(formData.get("runId"));
  if (!parsed.success) return { status: "error", message: "Invalid cleanup preview." };
  const { data, error } = await createAdminClient().rpc("cleanup_confirm_preview", { p_actor_uuid: actor.id, p_run_uuid: parsed.data });
  if (error || !data) return { status: "error", message: isMissingCleanupSchemaError(error) ? unavailable : "The preview expired or could not be confirmed." };
  await dispatch(parsed.data);
  revalidatePath("/admin/profile");
  return { status: "success", message: "Cleanup queued. You can leave this page safely." };
}

export async function resumeCleanupRunAction(formData: FormData): Promise<void> {
  const actor = await requireProfile(["super_admin"]);
  const parsed = cleanupRunIdSchema.safeParse(formData.get("runId"));
  if (!parsed.success) return;
  const { error } = await createAdminClient().rpc("cleanup_resume_run", { p_actor_uuid: actor.id, p_run_uuid: parsed.data });
  if (!error) await dispatch(parsed.data);
  revalidatePath("/admin/profile");
}
