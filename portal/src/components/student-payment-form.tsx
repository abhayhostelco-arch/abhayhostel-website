"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { resubmitStudentPaymentAction, submitStudentPaymentAction } from "@/app/actions/payments";
import { todayInIndia } from "@/lib/date";
import { initialActionState, type StudentPayment } from "@/lib/types";

export function StudentPaymentForm({ payment }: { payment?: StudentPayment }) {
  const actionFn = payment ? resubmitStudentPaymentAction : submitStudentPaymentAction;
  const [state, action, pending] = useActionState(actionFn, initialActionState);
  const today = todayInIndia();
  return <form action={action} className="split-form">
    {payment ? <><input type="hidden" name="paymentId" value={payment.id} /><input type="hidden" name="version" value={payment.version} /></> : null}
    <div className="field"><label htmlFor={`feeMonth-${payment?.id ?? "new"}`}>Fee month</label><input id={`feeMonth-${payment?.id ?? "new"}`} name="feeMonth" type="month" defaultValue={payment?.fee_month.slice(0, 7) ?? today.slice(0, 7)} required />{state.fieldErrors?.feeMonth?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
    <div className="field"><label htmlFor={`amount-${payment?.id ?? "new"}`}>Amount (INR)</label><input id={`amount-${payment?.id ?? "new"}`} name="amount" inputMode="decimal" pattern="\d+(\.\d{1,2})?" defaultValue={payment ? (payment.amount_paise / 100).toFixed(2) : ""} required />{state.fieldErrors?.amount?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
    <div className="field"><label htmlFor={`paymentDate-${payment?.id ?? "new"}`}>Payment date</label><input id={`paymentDate-${payment?.id ?? "new"}`} name="paymentDate" type="date" max={today} defaultValue={payment?.payment_date ?? today} required />{state.fieldErrors?.paymentDate?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
    <div className="field"><label htmlFor={`utr-${payment?.id ?? "new"}`}>UPI reference (UTR)</label><input id={`utr-${payment?.id ?? "new"}`} name="utr" minLength={6} maxLength={40} pattern="[A-Za-z0-9]+" defaultValue={payment?.utr ?? ""} required />{state.fieldErrors?.utr?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
    <div className="field full-span"><label htmlFor={`note-${payment?.id ?? "new"}`}>Note (optional)</label><textarea id={`note-${payment?.id ?? "new"}`} name="note" maxLength={500} defaultValue={payment?.note ?? ""} />{state.fieldErrors?.note?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
    {state.message ? <p className={`form-message full-span ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    <div className="full-span form-submit-bar"><button className="button" type="submit" disabled={pending}><Send size={18} aria-hidden="true" />{pending ? "Saving…" : payment ? "Resubmit for Review" : "Submit Payment"}</button></div>
  </form>;
}
