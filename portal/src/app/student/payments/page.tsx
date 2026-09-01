/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { StudentPaymentForm } from "@/components/student-payment-form";
import { StudentPaymentEdit } from "@/components/student-payment-edit";
import { CancelPaymentButton } from "@/components/cancel-payment-button";
import { requireProfile } from "@/lib/auth";
import { displayDate } from "@/lib/date";
import { getPaymentQrSignedUrl, getPaymentSettings, getStudentPayments } from "@/lib/data";
import { formatInr } from "@/lib/payments";

export const metadata: Metadata = { title: "Monthly payments" };

export default async function StudentPaymentsPage() {
  await requireProfile(["student"]);
  const [settingsResult, paymentsResult] = await Promise.all([getPaymentSettings(), getStudentPayments()]);
  const qrUrl = settingsResult.settings ? await getPaymentQrSignedUrl(settingsResult.settings.qr_path) : null;
  return <main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">Monthly fee</p><h1>Payments</h1><p>Scan the current QR code, submit your UTR, and follow review updates here.</p></div></header>
    {!settingsResult.available || !paymentsResult.available ? <section className="panel"><div className="empty-state unavailable-state"><strong>Payments Unavailable</strong><p>Apply the supplied database migration to enable monthly payments.</p></div></section> : <>
      {qrUrl ? <section className="panel payment-instructions"><div className="panel-title"><h2>Instructions</h2></div><p style={{ whiteSpace: "pre-wrap" }}>{settingsResult.settings?.instructions || "Use the QR code to pay, then submit the payment details below."}</p></section> : null}
      <section className="payment-submission-grid section-gap">
        <article className="panel payment-submit-panel"><div className="panel-title"><div><h2>Submit payment</h2><span>UTR and amount are checked before review.</span></div></div>{!qrUrl ? <p className="field-hint section-gap-small">The QR code is not configured yet. You can still submit a payment record if you have already paid or received payment instructions separately.</p> : null}<StudentPaymentForm /></article>
        <aside className="panel payment-qr-panel">{qrUrl ? <><img src={qrUrl} alt="Monthly payment QR code" className="payment-qr-image" /><h2 className="payment-qr-caption">Pay by UPI</h2></> : <div className="empty-state"><strong>QR code not available</strong><p>Monthly payment details will be available after the Admin uploads the current QR code.</p></div>}</aside>
      </section>
      <section className="panel section-gap"><div className="panel-title"><h2>Payment history</h2><span>{paymentsResult.payments.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Fee month</th><th>Amount</th><th>Paid on</th><th>UTR</th><th>Status</th><th>Review note</th><th>Actions</th></tr></thead><tbody>{paymentsResult.payments.map((payment) => <tr key={payment.id}><td>{displayDate(payment.fee_month)}</td><td>{formatInr(payment.amount_paise)}</td><td>{displayDate(payment.payment_date)}</td><td>{payment.utr}</td><td><span className={`status-pill status-${payment.status === "verified" ? "success" : payment.status === "rejected" ? "danger" : "warning"}`}>{payment.status}</span></td><td>{payment.rejection_reason ?? "—"}</td><td>{payment.status !== "verified" ? <div className="payment-actions"><StudentPaymentEdit payment={payment} /><CancelPaymentButton paymentId={payment.id} /></div> : "—"}</td></tr>)}</tbody></table>{!paymentsResult.payments.length ? <div className="empty-state"><strong>No payments yet</strong><p>Your submitted payments will appear here.</p></div> : null}</div></section>
    </>}
  </main>;
}
