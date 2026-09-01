import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildLeaveDecisionEmail, sendLeaveDecisionEmail } from "@/lib/leave-email";

const delivery = {
  id: "11111111-1111-4111-8111-111111111111",
  leave_request_id: "22222222-2222-4222-8222-222222222222",
  decision_version: 2,
  decision: "rejected" as const,
  recipient_email: "student@example.com",
  student_name: "Asha <script>alert(1)</script>",
  leave_start_date: "2026-09-10",
  leave_end_date: "2026-09-12",
  decision_note: "Use <b>approved plans</b> instead.",
  idempotency_key: "leave-decision:22222222-2222-4222-8222-222222222222:2",
};

describe("leave decision email", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("escapes decision snapshot values in HTML while retaining readable plain text", () => {
    const message = buildLeaveDecisionEmail(delivery, "https://portal.example.test");

    expect(message.subject).toBe("Your leave request was rejected");
    expect(message.html).toContain("Asha &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(message.html).toContain("Use &lt;b&gt;approved plans&lt;/b&gt; instead.");
    expect(message.html).not.toContain("<script>alert(1)</script>");
    expect(message.text).toContain("10 Sept 2026 to 12 Sept 2026");
    expect(message.text).toContain("Use <b>approved plans</b> instead.");
    expect(message.text).toContain("https://portal.example.test/student/leave");
  });

  it("sends the durable snapshot through Resend with its stable idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "resend-message-123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEAVE_EMAIL_FROM = "Abhay Hostel <leave@example.test>";

    const result = await sendLeaveDecisionEmail(delivery, "https://portal.example.test");

    expect(result).toEqual({ id: "resend-message-123" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer re_test_key", "Idempotency-Key": delivery.idempotency_key }),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      from: "Abhay Hostel <leave@example.test>", to: ["student@example.com"], subject: "Your leave request was rejected",
    });
  });
});
