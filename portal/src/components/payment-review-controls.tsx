"use client";

import { useActionState } from "react";
import { reviewStudentPaymentAction } from "@/app/actions/payments";
import { initialActionState, type StudentPayment } from "@/lib/types";

export function PaymentReviewControls({ payment }: { payment: StudentPayment }) {
  const [state, action, pending] = useActionState(reviewStudentPaymentAction, initialActionState);
  if (payment.status !== "pending") return <span className={`status-pill status-${payment.status === "verified" ? "success" : "danger"}`}>{payment.status}</span>;
  return <form action={action} className="stack-form">
    <input type="hidden" name="paymentId" value={payment.id} /><input type="hidden" name="version" value={payment.version} />
    <textarea name="rejectionReason" maxLength={500} aria-label="Rejection reason" placeholder="Required only when rejecting" />
    {state.fieldErrors?.rejectionReason?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}
    {state.message ? <p className={`form-message ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    <div className="button-row"><button className="button button-small" type="submit" name="decision" value="verified" disabled={pending}>Verify</button><button className="button button-secondary button-small" type="submit" name="decision" value="rejected" disabled={pending}>Reject</button></div>
  </form>;
}
