import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import type { StudentPayment } from "@/lib/types";

const mocks = vi.hoisted(() => ({ requireProfile: vi.fn(), getPaymentSettings: vi.fn(), getPaymentQrSignedUrl: vi.fn(), getStudentPayments: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/data", () => ({ getPaymentSettings: mocks.getPaymentSettings, getPaymentQrSignedUrl: mocks.getPaymentQrSignedUrl, getStudentPayments: mocks.getStudentPayments }));
vi.mock("@/components/student-payment-form", () => ({ StudentPaymentForm: () => <div>payment form</div> }));
vi.mock("@/components/student-payment-edit", () => ({ StudentPaymentEdit: ({ payment }: { payment: StudentPayment }) => <button type="button">{payment.status === "rejected" ? "Correct rejected payment" : "Edit pending payment"}</button> }));
vi.mock("@/components/cancel-payment-button", () => ({ CancelPaymentButton: () => <button type="button">Cancel request</button> }));

import StudentPaymentsPage from "@/app/student/payments/page";

const payment = (status: StudentPayment["status"]): StudentPayment => ({
  id: `00000000-0000-4000-8000-00000000000${status.length}`, student_id: "student", fee_month: "2026-08-01", amount_paise: 123450,
  payment_date: "2026-09-01", utr: "ABC123", note: null, status, reviewed_by: status === "pending" ? null : "admin", reviewed_at: status === "pending" ? null : "2026-09-01T00:00:00Z",
  rejection_reason: status === "rejected" ? "Please correct the UTR." : null, version: 1, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireProfile.mockResolvedValue({ id: "student", role: "student", is_active: true });
  mocks.getStudentPayments.mockResolvedValue({ available: true, payments: [] });
  mocks.getPaymentSettings.mockResolvedValue({ available: true, settings: { qr_path: null, instructions: "", id: true } });
  mocks.getPaymentQrSignedUrl.mockResolvedValue(null);
});

describe("student payment page", () => {
  it("shows a clear no-QR state before an Admin configures payment collection", async () => {
    const page = await StudentPaymentsPage();
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(html).toContain("QR code not available");
    expect(html).not.toContain("Submit Payment");
  });

  it("retains verified history while offering pending edits and rejected corrections", async () => {
    mocks.getPaymentSettings.mockResolvedValue({ available: true, settings: { qr_path: "settings/qr.png", instructions: "Scan and pay", id: true } });
    mocks.getPaymentQrSignedUrl.mockResolvedValue("https://example.test/qr");
    mocks.getStudentPayments.mockResolvedValue({ available: true, payments: [payment("pending"), payment("rejected"), payment("verified")] });

    const page = await StudentPaymentsPage();
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(html).toContain("Edit pending payment");
    expect(html).toContain("Correct rejected payment");
    expect(html).toContain("Please correct the UTR.");
    expect(html).toContain("verified");
  });
});
