"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { todayInIndia } from "@/lib/date";
import { paymentFormSchema, paymentReviewSchema } from "@/lib/payments";
import { isPaymentQrImage, replacePaymentQr } from "@/lib/payment-qr";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";
import { flattenErrors } from "@/lib/validation";

const duplicateMessage = "Payment submission conflicts with an existing record. Check the fee month and UTR.";

function revalidatePaymentPages() {
  revalidatePath("/student/payments");
  revalidatePath("/mentor/payments");
  revalidatePath("/admin/payments");
}

function paymentValues(formData: FormData) {
  return {
    feeMonth: formData.get("feeMonth"), amount: formData.get("amount"), paymentDate: formData.get("paymentDate"),
    utr: formData.get("utr"), note: formData.get("note") ?? "",
  };
}

export async function submitStudentPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["student"]);
  const parsed = paymentFormSchema(todayInIndia()).safeParse(paymentValues(formData));
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Check the payment details." };

  const { error } = await createAdminClient().rpc("submit_student_payment", {
    p_actor_uuid: profile.id, p_fee_month: parsed.data.feeMonth, p_amount_paise: parsed.data.amountPaise,
    p_payment_date: parsed.data.paymentDate, p_utr: parsed.data.utr, p_note: parsed.data.note ?? "",
  });
  if (error) return { status: "error", message: error.code === "23505" ? duplicateMessage : "The payment could not be submitted." };
  revalidatePaymentPages();
  return { status: "success", message: "Payment submitted for review." };
}

export async function resubmitStudentPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["student"]);
  const parsed = paymentFormSchema(todayInIndia()).safeParse(paymentValues(formData));
  const identity = z.object({ paymentId: z.uuid(), version: z.coerce.number().int().positive() }).safeParse({ paymentId: formData.get("paymentId"), version: formData.get("version") });
  if (!parsed.success || !identity.success) return { status: "error", fieldErrors: parsed.success ? undefined : flattenErrors(parsed.error), message: "Check the payment details." };

  const { error } = await createAdminClient().rpc("resubmit_student_payment", {
    p_actor_uuid: profile.id, p_payment_uuid: identity.data.paymentId, p_expected_version: identity.data.version,
    p_fee_month: parsed.data.feeMonth, p_amount_paise: parsed.data.amountPaise, p_payment_date: parsed.data.paymentDate,
    p_utr: parsed.data.utr, p_note: parsed.data.note ?? "",
  });
  if (error) {
    if (error.code === "23505") return { status: "error", message: duplicateMessage };
    if (error.code === "40001") return { status: "error", message: "This payment changed before resubmission. Refresh and try again." };
    return { status: "error", message: "This payment can no longer be changed." };
  }
  revalidatePaymentPages();
  return { status: "success", message: "Payment resubmitted for review." };
}

export async function reviewStudentPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["super_admin", "admin"]);
  const parsed = paymentReviewSchema.safeParse({
    paymentId: formData.get("paymentId"), version: formData.get("version"), decision: formData.get("decision"),
    rejectionReason: formData.get("rejectionReason") ?? "",
  });
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), message: "Check the review decision." };

  const { error } = await createAdminClient().rpc(
    parsed.data.decision === "verified" ? "verify_student_payment" : "reject_student_payment",
    parsed.data.decision === "verified"
      ? { p_actor_uuid: profile.id, p_payment_uuid: parsed.data.paymentId, p_expected_version: parsed.data.version }
      : { p_actor_uuid: profile.id, p_payment_uuid: parsed.data.paymentId, p_expected_version: parsed.data.version, p_rejection_reason: parsed.data.rejectionReason! },
  );
  if (error) {
    if (error.code === "40001") return { status: "error", message: "This payment changed before review. Refresh and try again." };
    return { status: "error", message: "This payment could not be reviewed." };
  }
  revalidatePaymentPages();
  return { status: "success", message: parsed.data.decision === "verified" ? "Payment verified." : "Payment rejected with a correction request." };
}

const qrMimeExtensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const qrFilenameExtensions = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] } as const;

export async function updatePaymentSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["super_admin"]);
  const instructions = z.string().trim().max(4000, "Instructions must be at most 4,000 characters.").safeParse(formData.get("instructions") ?? "");
  if (!instructions.success) return { status: "error", fieldErrors: flattenErrors(instructions.error), message: "Check the payment instructions." };

  const admin = createAdminClient();
  const current = await admin.from("payment_settings").select("qr_path").eq("id", true).maybeSingle();
  if (current.error || !current.data) return { status: "error", message: "Payment settings could not be loaded." };
  const candidate = formData.get("qrFile");
  const file = typeof File !== "undefined" && candidate instanceof File && candidate.size > 0 ? candidate : null;
  const extension = file?.name.split(".").pop()?.toLowerCase();
  if (file && (!(file.type in qrMimeExtensions) || !extension || !qrFilenameExtensions[file.type as keyof typeof qrFilenameExtensions].includes(extension as never) || file.size > 2 * 1024 * 1024 || !await isPaymentQrImage(file))) {
    return { status: "error", message: "Use a JPG, PNG, or WebP image no larger than 2 MB." };
  }
  const save = (qrPath: string | null) => admin.rpc("update_payment_settings", {
    p_actor_uuid: profile.id, p_qr_path: qrPath ?? "", p_instructions: instructions.data,
  });
  if (!file) {
    const { error } = await save(current.data.qr_path);
    if (error) return { status: "error", message: "Payment settings could not be saved." };
  } else {
    const newPath = `settings/qr-${Date.now()}.${qrMimeExtensions[file.type as keyof typeof qrMimeExtensions]}`;
    const result = await replacePaymentQr({
      oldPath: current.data.qr_path,
      newPath,
      file,
      upload: (path, value, options) => admin.storage.from("payment-qr").upload(path, value, options),
      remove: (paths) => admin.storage.from("payment-qr").remove(paths),
      updateSettings: () => save(newPath),
    });
    if (!result.ok) return { status: "error", message: "The QR code could not be saved. Existing settings were retained." };
    if (result.previousQrCleanupFailed) {
      revalidatePath("/admin/settings");
      revalidatePaymentPages();
      return { status: "success", message: "Payment settings saved. The previous QR could not be removed automatically; it was logged for follow-up." };
    }
  }
  revalidatePath("/admin/settings");
  revalidatePaymentPages();
  return { status: "success", message: "Payment settings saved." };
}
