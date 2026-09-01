"use client";

import { useActionState } from "react";
import { cancelStudentPaymentAction } from "@/app/actions/payments";
import { initialActionState } from "@/lib/types";

export function CancelPaymentButton({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(cancelStudentPaymentAction, initialActionState);
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Cancel this payment request?")) event.preventDefault(); }}>
    <input type="hidden" name="paymentId" value={paymentId} />
    <button className="button button-danger button-small" type="submit" disabled={pending}>{pending ? "Cancelling…" : "Cancel request"}</button>
    {state.status === "error" && state.message ? <p className="field-error" role="alert">{state.message}</p> : null}
  </form>;
}
