import "server-only";
import { sendLeaveDecisionEmail, type LeaveDecisionEmailSnapshot } from "@/lib/leave-email";

type ClaimedDelivery = LeaveDecisionEmailSnapshot & { lease_token: string };
type NotificationAdmin = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }> };

function deliveryError(error: unknown) {
  if (error instanceof Error && error.message) return error.message.slice(0, 2000);
  return "delivery failed";
}

function isClaimedDelivery(value: unknown): value is ClaimedDelivery {
  if (!value || typeof value !== "object") return false;
  const delivery = value as Record<string, unknown>;
  return typeof delivery.id === "string" && typeof delivery.leave_request_id === "string" && typeof delivery.decision_version === "number"
    && (delivery.decision === "approved" || delivery.decision === "rejected") && (typeof delivery.recipient_email === "string" || delivery.recipient_email === null)
    && typeof delivery.student_name === "string" && typeof delivery.leave_start_date === "string" && typeof delivery.leave_end_date === "string"
    && (typeof delivery.decision_note === "string" || delivery.decision_note === null) && typeof delivery.idempotency_key === "string" && typeof delivery.lease_token === "string";
}

export async function deliverLeaveNotifications(admin: NotificationAdmin, workerId: string, appUrl: string): Promise<Array<{ notificationId: string; status: "sent" | "failed" }>> {
  const claim = await admin.rpc("claim_leave_notification_batch", { p_worker_uuid: workerId, p_limit: 50, p_lease_seconds: 60 });
  if (claim.error || !Array.isArray(claim.data)) return [];
  const outcomes: Array<{ notificationId: string; status: "sent" | "failed" }> = [];
  for (const delivery of claim.data.filter(isClaimedDelivery)) {
    try {
      const provider = await sendLeaveDecisionEmail(delivery, appUrl);
      const completion = await admin.rpc("complete_leave_notification_delivery", {
        p_notification_uuid: delivery.id, p_worker_uuid: workerId, p_lease_token: delivery.lease_token,
        p_succeeded: true, p_provider_message_id: provider.id, p_error: null,
      });
      outcomes.push({ notificationId: delivery.id, status: completion.error ? "failed" : "sent" });
    } catch (error) {
      await admin.rpc("complete_leave_notification_delivery", {
        p_notification_uuid: delivery.id, p_worker_uuid: workerId, p_lease_token: delivery.lease_token,
        p_succeeded: false, p_provider_message_id: null, p_error: deliveryError(error),
      });
      outcomes.push({ notificationId: delivery.id, status: "failed" });
    }
  }
  return outcomes;
}
