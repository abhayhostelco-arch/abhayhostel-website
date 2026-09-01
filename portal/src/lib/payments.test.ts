import { describe, expect, it } from "vitest";
import { todayInIndia } from "@/lib/date";

async function loadPayments() {
  try {
    const modulePath = "@/lib/payments";
    return await import(/* @vite-ignore */ modulePath) as typeof import("@/lib/payments");
  } catch {
    return null;
  }
}

describe("payment form values", () => {
  it("converts whole and fractional INR exactly into paise", async () => {
    const payments = await loadPayments();
    expect(payments).not.toBeNull();
    if (!payments) return;

    expect(payments.inrToPaise("1")).toBe(100);
    expect(payments.inrToPaise("1234.50")).toBe(123450);
    expect(payments.inrToPaise("0.01")).toBe(1);
  });

  it("accepts the date and text boundaries for a student submission", async () => {
    const payments = await loadPayments();
    expect(payments).not.toBeNull();
    if (!payments) return;

    const parsed = payments.paymentFormSchema("2026-09-01").safeParse({
      feeMonth: "2026-08", amount: "99.99", paymentDate: "2026-09-01",
      utr: "ab12cd", note: "x".repeat(500),
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ feeMonth: "2026-08-01", amountPaise: 9999, utr: "AB12CD" });
  });

  it("rejects fractional paise, future India dates, malformed UTRs, and oversized notes", async () => {
    const payments = await loadPayments();
    expect(payments).not.toBeNull();
    if (!payments) return;

    const schema = payments.paymentFormSchema("2026-09-01");
    const invalid = schema.safeParse({
      feeMonth: "2026-08", amount: "1.001", paymentDate: "2026-09-02",
      utr: "abc-123", note: "x".repeat(501),
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.flatten().fieldErrors).toMatchObject({ amount: expect.any(Array), paymentDate: expect.any(Array), utr: expect.any(Array), note: expect.any(Array) });
  });

  it("uses the India calendar day when validating a payment date near UTC midnight", async () => {
    const payments = await loadPayments();
    expect(payments).not.toBeNull();
    if (!payments) return;
    const indiaToday = todayInIndia(new Date("2026-08-21T19:00:00Z"));

    expect(payments.paymentFormSchema(indiaToday).safeParse({
      feeMonth: "2026-08", amount: "1", paymentDate: "2026-08-22", utr: "ABC123", note: "",
    }).success).toBe(true);
  });
});
