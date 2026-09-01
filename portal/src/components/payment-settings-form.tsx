"use client";
/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useRef, useState } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import { updatePaymentSettingsAction } from "@/app/actions/payments";
import { initialActionState, type PaymentSettings } from "@/lib/types";

const defaultPaymentInstructions = "Use the QR code to pay, then submit the payment details below.";

export function PaymentSettingsForm({ settings, qrUrl }: { settings: PaymentSettings; qrUrl: string | null }) {
  const [state, action, pending] = useActionState(updatePaymentSettingsAction, initialActionState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  useEffect(() => () => { if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl); }, [selectedPreviewUrl]);
  const previewUrl = selectedPreviewUrl ?? qrUrl;
  return <form action={action} className="split-form">
    <div className="field full-span"><label htmlFor="paymentInstructions">Payment instructions</label><textarea id="paymentInstructions" name="instructions" rows={5} maxLength={4000} defaultValue={settings.instructions || defaultPaymentInstructions} />{state.fieldErrors?.instructions?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
    <input ref={fileInputRef} id="paymentQr" name="qrFile" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; setSelectedFileName(file?.name ?? ""); setSelectedPreviewUrl(file ? URL.createObjectURL(file) : null); }} />
    {previewUrl ? <div className="payment-current-qr full-span"><img src={previewUrl} alt={selectedPreviewUrl ? "Selected replacement payment QR code" : "Current payment QR code"} /><div><h3>{selectedPreviewUrl ? "New QR code preview" : "Current UPI QR code"}</h3><p>{selectedPreviewUrl ? "Save settings to publish this QR code to students." : "Students can scan this code and submit their UTR for verification."}</p>{selectedFileName ? <p className="field-hint"><strong>Selected:</strong> {selectedFileName}</p> : null}</div></div> : <div className="payment-qr-setup full-span"><div><h3>No UPI QR code yet</h3><p>Upload the QR code students should use for monthly payments.</p></div></div>}
    <div className="payment-qr-actions full-span"><button className="button button-secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={pending}><Upload size={17} aria-hidden="true" />{qrUrl ? "Replace QR code" : selectedPreviewUrl ? "Choose another QR code" : "Upload QR code"}</button>{qrUrl ? <button className="button button-danger" type="submit" name="removeQr" value="on" disabled={pending}><Trash2 size={17} aria-hidden="true" />Remove QR code</button> : null}<span className="field-hint">JPG, PNG, or WebP · 2 MB maximum.</span></div>
    {state.message ? <p className={`form-message full-span ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    <div className="full-span form-submit-bar"><button className="button" type="submit" disabled={pending}><Save size={18} aria-hidden="true" />{pending ? "Saving…" : selectedFileName ? "Save replacement" : "Save Payment Settings"}</button></div>
  </form>;
}
