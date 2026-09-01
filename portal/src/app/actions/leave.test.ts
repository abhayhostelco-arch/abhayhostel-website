import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), requireProfile: vi.fn(), rpc: vi.fn(), from: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://portal.example.test" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: mocks.rpc,
  from: mocks.from,
}) }));

async function loadActions() {
  return await import("@/app/actions/leave") as typeof import("@/app/actions/leave");
}

const admin = { id: "00000000-0000-4000-8000-000000000001", role: "super_admin", is_active: true };
const requestId = "00000000-0000-4000-8000-000000000002";
const notificationId = "00000000-0000-4000-8000-000000000003";

function decisionForm() {
  const form = new FormData();
  form.set("requestId", requestId); form.set("expectedStatus", "pending"); form.set("decision", "approved"); form.set("decisionNote", "");
  return form;
}

describe("leave decision server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfile.mockResolvedValue(admin);
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) });
    mocks.maybeSingle.mockResolvedValue({ data: { id: requestId, student_id: "00000000-0000-4000-8000-000000000099", attachment_path: null }, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: { changed: true, status: "approved", notification_id: notificationId }, error: null })
      .mockResolvedValueOnce({ data: { id: notificationId, leave_request_id: requestId, decision_version: 1, recipient_email: "student@example.com", student_name: "Asha", leave_start_date: "2026-09-10", leave_end_date: "2026-09-12", decision: "approved", decision_note: null, idempotency_key: "leave-decision:2:1", lease_token: "00000000-0000-4000-8000-000000000004" }, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEAVE_EMAIL_FROM = "Abhay Hostel <leave@example.test>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "provider-id" }), { status: 200 })));
  });

  it("commits a decision with the compare-and-set RPC before delivering its email", async () => {
    const actions = await loadActions();

    const result = await actions.decideLeaveRequestAction({ status: "idle" }, decisionForm());

    expect(result).toEqual({ status: "success", message: "Decision saved; email sent" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "decide_leave_request", {
      p_actor_uuid: admin.id, p_request_uuid: requestId, p_expected_status: "pending", p_decision: "approved", p_decision_note: null,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "claim_leave_notification", expect.objectContaining({ p_notification_uuid: notificationId }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/students/00000000-0000-4000-8000-000000000099");
  });

  it("does not claim or email again when the decision RPC reports a no-op", async () => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: { changed: false, status: "approved" }, error: null });
    const actions = await loadActions();

    const result = await actions.decideLeaveRequestAction({ status: "idle" }, decisionForm());

    expect(result).toEqual({ status: "success", message: "Decision was already saved; no email was sent." });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("allows only Super Admins to retry a failed notification", async () => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: [], error: null });
    const form = new FormData(); form.set("notificationId", notificationId);
    const actions = await loadActions();

    const result = await actions.retryLeaveNotificationAction({ status: "idle" }, form);

    expect(result).toEqual({ status: "success", message: "Email retry queued." });
    expect(mocks.requireProfile).toHaveBeenCalledWith(["super_admin"]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "retry_leave_notification", { p_actor_uuid: admin.id, p_notification_uuid: notificationId });
  });
});
