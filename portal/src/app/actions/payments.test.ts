import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireProfile: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));

async function loadActions() {
  try {
    const modulePath = "@/app/actions/payments";
    return await import(/* @vite-ignore */ modulePath) as typeof import("@/app/actions/payments");
  } catch {
    return null;
  }
}

const student = { id: "00000000-0000-4000-8000-000000000001", role: "student", is_active: true };
const mentor = { id: "00000000-0000-4000-8000-000000000002", role: "admin", is_active: true };
const paymentId = "00000000-0000-4000-8000-000000000003";

function paymentForm() {
  const form = new FormData();
  form.set("feeMonth", "2026-08"); form.set("amount", "1234.50"); form.set("paymentDate", "2026-09-01"); form.set("utr", "ab12cd"); form.set("note", "Paid by UPI");
  return form;
}

describe("payment server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfile.mockResolvedValue(student);
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
  });

  it("submits paise through the service-only payment RPC", async () => {
    const actions = await loadActions();
    expect(actions).not.toBeNull();
    if (!actions) return;

    const result = await actions.submitStudentPaymentAction({ status: "idle" }, paymentForm());

    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("submit_student_payment", {
      p_actor_uuid: student.id, p_fee_month: "2026-08-01", p_amount_paise: 123450,
      p_payment_date: "2026-09-01", p_utr: "AB12CD", p_note: "Paid by UPI",
    });
  });

  it("keeps duplicate UTR failures generic", async () => {
    const actions = await loadActions();
    expect(actions).not.toBeNull();
    if (!actions) return;
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "student_payments_utr_key" } });

    const result = await actions.submitStudentPaymentAction({ status: "idle" }, paymentForm());

    expect(result).toEqual({ status: "error", message: "Payment submission conflicts with an existing record. Check the fee month and UTR." });
  });

  it("sends a Mentor review through the compare-and-set RPC without exposing cohort data", async () => {
    const actions = await loadActions();
    expect(actions).not.toBeNull();
    if (!actions) return;
    mocks.requireProfile.mockResolvedValue(mentor);
    const form = new FormData();
    form.set("paymentId", paymentId); form.set("version", "4"); form.set("decision", "verified"); form.set("rejectionReason", "");

    const result = await actions.reviewStudentPaymentAction({ status: "idle" }, form);

    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("verify_student_payment", { p_actor_uuid: mentor.id, p_payment_uuid: paymentId, p_expected_version: 4 });
  });

  it("reports stale compare-and-set reviews without applying a second decision", async () => {
    const actions = await loadActions();
    expect(actions).not.toBeNull();
    if (!actions) return;
    mocks.requireProfile.mockResolvedValue(mentor);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "payment changed before review" } });
    const form = new FormData();
    form.set("paymentId", paymentId); form.set("version", "4"); form.set("decision", "rejected"); form.set("rejectionReason", "UTR is unclear");

    const result = await actions.reviewStudentPaymentAction({ status: "idle" }, form);

    expect(result).toEqual({ status: "error", message: "This payment changed before review. Refresh and try again." });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
