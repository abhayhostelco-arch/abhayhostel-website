"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function decideLeaveRequestAction(formData: FormData) {
  const profile = await requireProfile(["super_admin"]);
  const parsed = leaveDecisionSchema.safeParse({ requestId: formData.get("requestId"), decision: formData.get("decision"), decisionNote: formData.get("decisionNote") ?? "" });
  if (!parsed.success) return;
  const admin = createAdminClient();
  const { data, error } = await admin.from("leave_requests").update({
    status: parsed.data.decision, decision_note: parsed.data.decisionNote, decided_by: profile.id, decided_at: new Date().toISOString(),
  }).eq("id", parsed.data.requestId).in("status", ["pending", "approved"]).select("id,student_id,attachment_path").maybeSingle();
  if (error || !data) return;
  if (parsed.data.decision === "rejected") {
    await removeLeaveAttachment({
      path: data.attachment_path,
      removeObject: async (path) => !(await admin.storage.from("leave-applications").remove([path])).error,
      clearPath: async () => !(await admin.from("leave_requests").update({ attachment_path: null }).eq("id", data.id)).error,
    });
  }
  await admin.from("audit_events").insert({ actor_id: profile.id, action: parsed.data.decision === "approved" ? "leave_approved" : "leave_rejected", target_id: data.id, metadata: { student_id: data.student_id } });
  revalidateLeavePages();
  revalidatePath(`/admin/students/${data.student_id}`);
  revalidatePath(`/mentor/students/${data.student_id}`);
}
