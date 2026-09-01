import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { deliverLeaveNotification, deliverLeaveNotifications } from "@/lib/leave-notifications";

const delivery = {
  id: "11111111-1111-4111-8111-111111111111",
  leave_request_id: "22222222-2222-4222-8222-222222222222",
  student_id: "33333333-3333-4333-8333-333333333333",
  decision_version: 1,
  decision: "approved" as const,
  recipient_email: "student@example.com",
  student_name: "Asha Student",
  leave_start_date: "2026-09-10",
  leave_end_date: "2026-09-12",
  decision_note: null,
  idempotency_key: "leave-decision:22222222-2222-4222-8222-222222222222:1",
  lease_token: "44444444-4444-4444-8444-444444444444",
};

function adminWith(claimed: unknown) {
  const rpc = vi.fn()
    .mockResolvedValueOnce({ data: claimed, error: null })
    .mockResolvedValue({ data: true, error: null });
  return { rpc };
}

describe("leave notification delivery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("claims a short lease and completes only with that lease token after Resend accepts the idempotent message", async () => {
    const admin = adminWith([delivery]);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEAVE_EMAIL_FROM = "Abhay Hostel <leave@example.test>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "provider-id" }), { status: 200 })));

    const outcomes = await deliverLeaveNotifications(admin, "55555555-5555-4555-8555-555555555555", "https://portal.example.test");

    expect(outcomes).toEqual([{ notificationId: delivery.id, status: "sent" }]);
    expect(admin.rpc).toHaveBeenNthCalledWith(1, "claim_leave_notification_batch", {
      p_worker_uuid: "55555555-5555-4555-8555-555555555555", p_limit: 50, p_lease_seconds: 60,
    });
    expect(admin.rpc).toHaveBeenNthCalledWith(2, "complete_leave_notification_delivery", {
      p_notification_uuid: delivery.id, p_worker_uuid: "55555555-5555-4555-8555-555555555555",
      p_lease_token: delivery.lease_token, p_succeeded: true, p_provider_message_id: "provider-id", p_error: null,
    });
  });

  it("records a retryable failure without calling Resend when a claimed snapshot has no usable recipient", async () => {
    const admin = adminWith([{ ...delivery, recipient_email: null }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const outcomes = await deliverLeaveNotifications(admin, "55555555-5555-4555-8555-555555555555", "https://portal.example.test");

    expect(outcomes).toEqual([{ notificationId: delivery.id, status: "failed" }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenLastCalledWith("complete_leave_notification_delivery", expect.objectContaining({
      p_notification_uuid: delivery.id, p_succeeded: false, p_provider_message_id: null,
      p_error: "recipient email is missing or invalid",
    }));
  });

  it("claims and delivers the newly created notification directly instead of relying on the global batch order", async () => {
    const admin = adminWith(delivery);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEAVE_EMAIL_FROM = "Abhay Hostel <leave@example.test>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "provider-id" }), { status: 200 })));

    const outcome = await deliverLeaveNotification(admin, "55555555-5555-4555-8555-555555555555", delivery.id, "https://portal.example.test");

    expect(outcome).toEqual({ notificationId: delivery.id, status: "sent" });
    expect(admin.rpc).toHaveBeenNthCalledWith(1, "claim_leave_notification", {
      p_worker_uuid: "55555555-5555-4555-8555-555555555555", p_notification_uuid: delivery.id, p_lease_seconds: 60,
    });
  });
});
