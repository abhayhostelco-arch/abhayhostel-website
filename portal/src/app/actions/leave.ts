"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { deliverLeaveNotification, deliverLeaveNotifications } from "@/lib/leave-notifications";
import { isMissingSchemaError } from "@/lib/schema-compat";
import { canWithdrawLeaveRequest } from "@/lib/date";
import { removeLeaveAttachment } from "@/lib/leave-attachments";
import type { ActionState } from "@/lib/types";
import { flattenErrors, leaveAttachmentPathSchema, leaveAttachmentUploadRequestSchema, leaveDecisionSchema, leaveRequestSchema, leaveWithdrawalSchema } from "@/lib/validation";

const attachmentExtensions = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" } as const;

export type LeaveAttachmentUploadGrant =
  | { status: "success"; path: string; token: string }
  | { status: "error"; message: string };

function revalidateLeavePages() {
  revalidatePath("/student");
  revalidatePath("/student/leave");
  revalidatePath("/admin");
  revalidatePath("/admin/leaves");
  revalidatePath("/admin/daily-tracking");
  revalidatePath("/mentor/leaves");
  revalidatePath("/mentor/daily-tracking");
}

async function removeOwnedAttachment(profileId: string, path: FormDataEntryValue | null) {
  if (typeof path !== "string") return;
  const parsed = leaveAttachmentPathSchema.safeParse(path);
  if (!parsed.success || !parsed.data.startsWith(`${profileId}/`)) return;
  await createAdminClient().storage.from("leave-applications").remove([parsed.data]);
}

export async function createLeaveAttachmentUploadAction(input: unknown): Promise<LeaveAttachmentUploadGrant> {
  const profile = await requireProfile(["student"]);
  const parsed = leaveAttachmentUploadRequestSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Use a JPG, PNG, or PDF no larger than 5 MB." };
  const extension = attachmentExtensions[parsed.data.type];
  const path = `${profile.id}/${parsed.data.requestId}/application-${Date.now()}.${extension}`;
  const { data, error } = await createAdminClient().storage.from("leave-applications").createSignedUploadUrl(path);
  if (error) return { status: "error", message: "The application attachment could not be prepared for upload." };
  return { status: "success", path, token: data.token };
}

export async function createLeaveRequestAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["student"]);
  const parsed = leaveRequestSchema.safeParse({
    requestId: formData.get("requestId"), startDate: formData.get("startDate"), endDate: formData.get("endDate"),
    reason: formData.get("reason"), attachmentPath: formData.get("attachmentPath") ?? "",
  });
  if (!parsed.success) {
    await removeOwnedAttachment(profile.id, formData.get("attachmentPath"));
    return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Check the leave dates and reason." };
  }
  if (parsed.data.attachmentPath && !parsed.data.attachmentPath.startsWith(`${profile.id}/${parsed.data.requestId}/`)) {
    await removeOwnedAttachment(profile.id, parsed.data.attachmentPath);
    return { status: "error", message: "Choose an application uploaded from your account." };
  }
  const supabase = await createClient();
  const overlap = await supabase.from("leave_requests").select("id").eq("student_id", profile.id)
    .in("status", ["pending", "approved"]).lte("start_date", parsed.data.endDate).gte("end_date", parsed.data.startDate).limit(1);
  if (isMissingSchemaError(overlap.error)) {
    await removeOwnedAttachment(profile.id, parsed.data.attachmentPath ?? null);
    return { status: "error", message: "Leave applications are unavailable until the database migration is applied." };
  }
  if (overlap.error) {
    await removeOwnedAttachment(profile.id, parsed.data.attachmentPath ?? null);
    return { status: "error", message: "The leave request could not be checked." };
  }
  if (overlap.data?.length) {
    await removeOwnedAttachment(profile.id, parsed.data.attachmentPath ?? null);
    return { status: "error", message: "These dates overlap an existing pending or approved request." };
  }
  const { error } = await supabase.from("leave_requests").insert({
    id: parsed.data.requestId, student_id: profile.id, start_date: parsed.data.startDate, end_date: parsed.data.endDate,
    reason: parsed.data.reason, attachment_path: parsed.data.attachmentPath ?? null, status: "pending",
  });
  if (isMissingSchemaError(error)) {
    await removeOwnedAttachment(profile.id, parsed.data.attachmentPath ?? null);
    return { status: "error", message: "Leave applications are unavailable until the database migration is applied." };
  }
  if (error) {
    await removeOwnedAttachment(profile.id, parsed.data.attachmentPath ?? null);
    return { status: "error", message: "The leave request could not be submitted." };
  }
  revalidateLeavePages();
  return { status: "success", message: "Leave application submitted for Admin review." };
}

export async function withdrawLeaveRequestAction(formData: FormData) {
  const profile = await requireProfile(["student"]);
  const parsed = leaveWithdrawalSchema.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) return;
  const admin = createAdminClient();
  const { data: request, error: requestError } = await admin.from("leave_requests")
    .select("id,status,start_date,attachment_path").eq("id", parsed.data.requestId).eq("student_id", profile.id).maybeSingle();
  if (requestError || !request || !canWithdrawLeaveRequest(request)) return;
  const { data, error } = await admin.from("leave_requests")
    .update({ status: "withdrawn", decided_at: new Date().toISOString() })
    .eq("id", request.id).eq("student_id", profile.id).eq("status", request.status).select("id,attachment_path").maybeSingle();
  if (error || !data) return;
  await removeLeaveAttachment({
    path: data.attachment_path,
    removeObject: async (path) => !(await admin.storage.from("leave-applications").remove([path])).error,
    clearPath: async () => !(await admin.from("leave_requests").update({ attachment_path: null }).eq("id", data.id).eq("student_id", profile.id)).error,
  });
  revalidateLeavePages();
}

export async function decideLeaveRequestAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["super_admin"]);
  const parsed = leaveDecisionSchema.safeParse({ requestId: formData.get("requestId"), expectedStatus: formData.get("expectedStatus"), decision: formData.get("decision"), decisionNote: formData.get("decisionNote") ?? "" });
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Check the leave decision." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("decide_leave_request", {
    p_actor_uuid: profile.id, p_request_uuid: parsed.data.requestId, p_expected_status: parsed.data.expectedStatus,
    p_decision: parsed.data.decision, p_decision_note: parsed.data.decisionNote,
  });
  if (error || !data || typeof data !== "object") {
    if (error?.code === "40001") return { status: "error", message: "This leave request changed before review. Refresh and try again." };
    return { status: "error", message: "This leave request could not be reviewed." };
  }
  const result = data as { changed?: unknown; status?: unknown; notification_id?: unknown };
  if (result.changed === false) return { status: "success", message: "Decision was already saved; no email was sent." };
  if (result.changed !== true || typeof result.notification_id !== "string") return { status: "error", message: "This leave request could not be reviewed." };
  const { data: request } = await admin.from("leave_requests").select("id,student_id,attachment_path").eq("id", parsed.data.requestId).maybeSingle();
  if (result.status === "rejected") {
    if (request) await removeLeaveAttachment({
      path: request.attachment_path,
      removeObject: async (path) => !(await admin.storage.from("leave-applications").remove([path])).error,
      clearPath: async () => !(await admin.from("leave_requests").update({ attachment_path: null }).eq("id", request.id)).error,
    });
  }
  const outcome = await deliverLeaveNotification(admin, randomUUID(), result.notification_id, getServerEnv().NEXT_PUBLIC_APP_URL);
  revalidateLeavePages();
  if (request?.student_id) {
    revalidatePath(`/admin/students/${request.student_id}`);
    revalidatePath(`/mentor/students/${request.student_id}`);
  }
  return { status: "success", message: outcome?.status === "sent" ? "Decision saved; email sent" : "Decision saved; email failed" };
}

export async function retryLeaveNotificationAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["super_admin"]);
  const parsed = z.uuid().safeParse(formData.get("notificationId"));
  if (!parsed.success) return { status: "error", message: "The email notification could not be retried." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("retry_leave_notification", { p_actor_uuid: profile.id, p_notification_uuid: parsed.data });
  if (error || data !== true) return { status: "error", message: "The email notification could not be retried." };
  await deliverLeaveNotifications(admin, randomUUID(), getServerEnv().NEXT_PUBLIC_APP_URL);
  revalidateLeavePages();
  return { status: "success", message: "Email retry queued." };
}
