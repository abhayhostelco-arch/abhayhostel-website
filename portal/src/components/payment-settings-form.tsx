"use client";
/* eslint-disable @next/next/no-img-element */

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updatePaymentSettingsAction } from "@/app/actions/payments";
import { initialActionState, type PaymentSettings } from "@/lib/types";

export function PaymentSettingsForm({ settings, qrUrl }: { settings: PaymentSettings; qrUrl: string | null }) {
  const [state, action, pending] = useActionState(updatePaymentSettingsAction, initialActionState);
  return <form action={action} className="split-form">
    <div className="field full-span"><label htmlFor="paymentInstructions">Payment instructions</label><textarea id="paymentInstructions" name="instructions" rows={5} maxLength={4000} defaultValue={settings.instructions} placeholder="Explain the monthly fee payment process." />{state.fieldErrors?.instructions?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
    <div className="field"><label htmlFor="paymentQr">UPI QR code</label><input id="paymentQr" name="qrFile" type="file" accept="image/jpeg,image/png,image/webp" /><p className="field-hint">JPG, PNG, or WebP · 2 MB maximum. Replacing it keeps the current QR until the new one is saved.</p></div>
    <div className="field">{qrUrl ? <><img src={qrUrl} alt="Current payment QR code" style={{ maxWidth: 180, height: "auto" }} /></> : <p className="field-hint">No QR code has been uploaded.</p>}</div>
    {state.message ? <p className={`form-message full-span ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    <div className="full-span form-submit-bar"><button className="button" type="submit" disabled={pending}><Save size={18} aria-hidden="true" />{pending ? "Saving…" : "Save Payment Settings"}</button></div>
  </form>;
}
