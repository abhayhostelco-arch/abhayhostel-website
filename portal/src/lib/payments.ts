import { z } from "zod";

const inrPattern = /^\d+(?:\.\d{1,2})?$/;
const maxSafePaise = BigInt(Number.MAX_SAFE_INTEGER);

function parseInrToPaise(value: string): number | null {
  if (!inrPattern.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const paise = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (paise <= BigInt(0) || paise > maxSafePaise) return null;
  return Number(paise);
}

export function inrToPaise(value: string): number {
  if (!inrPattern.test(value)) throw new Error("Enter an INR amount with at most two decimals.");
  const [whole, fraction = ""] = value.split(".");
  const paise = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (paise <= BigInt(0)) throw new Error("Enter an amount greater than zero.");
  if (paise > maxSafePaise) throw new RangeError("INR amount exceeds the safe paise limit.");
  return Number(paise);
}

export function paymentFormSchema(today: string) {
  return z.object({
    feeMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a fee month.").transform((value) => `${value}-01`),
    amount: z.string().regex(inrPattern, "Enter an INR amount with at most two decimals.").refine((value) => parseInrToPaise(value) !== null, "Enter a positive INR amount within the supported range.").transform((value) => parseInrToPaise(value) ?? 0),
    paymentDate: z.iso.date().refine((value) => value <= today, "Payment date cannot be after today in India."),
    utr: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,40}$/, "Enter a 6–40 character alphanumeric UTR."),
    note: z.string().trim().max(500, "Note must be at most 500 characters.").transform((value) => value || null),
  }).transform((value) => ({
    feeMonth: value.feeMonth,
    amountPaise: value.amount,
    paymentDate: value.paymentDate,
    utr: value.utr,
    note: value.note,
  }));
}

export const paymentReviewSchema = z.object({
  paymentId: z.uuid(),
  version: z.coerce.number().int().positive(),
  decision: z.enum(["verified", "rejected"]),
  rejectionReason: z.string().trim().max(500, "Rejection reason must be at most 500 characters.").transform((value) => value || null),
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.rejectionReason) {
    context.addIssue({ code: "custom", path: ["rejectionReason"], message: "Give a reason when rejecting a payment." });
  }
});

export function formatInr(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountPaise / 100);
}
