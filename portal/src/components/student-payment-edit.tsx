"use client";

import { Pencil, X } from "lucide-react";
import { useRef } from "react";
import { StudentPaymentForm } from "@/components/student-payment-form";
import type { StudentPayment } from "@/lib/types";

export function StudentPaymentEdit({ payment }: { payment: StudentPayment }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="button button-secondary button-small" type="button" onClick={(event) => {
        const dialog = event.currentTarget.nextElementSibling;
        if (dialog instanceof HTMLDialogElement) dialog.showModal();
      }}>
        <Pencil size={15} aria-hidden="true" /> Edit
      </button>
      <dialog ref={dialogRef} className="save-success-dialog payment-edit-dialog" aria-labelledby={`edit-payment-${payment.id}`}>
        <button className="icon-button payment-edit-close" type="button" aria-label="Close payment editor" onClick={(event) => (event.currentTarget.closest("dialog") as HTMLDialogElement | null)?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
        <p className="eyebrow">Payment correction</p>
        <h2 id={`edit-payment-${payment.id}`}>{payment.status === "rejected" ? "Correct rejected payment" : "Edit pending payment"}</h2>
        <p>Update the details before sending this payment for review again.</p>
        <StudentPaymentForm payment={payment} onCancel={() => dialogRef.current?.close()} />
      </dialog>
    </>
  );
}
