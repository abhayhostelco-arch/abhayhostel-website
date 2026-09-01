/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { StudentPaymentForm } from "@/components/student-payment-form";
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
      {qrUrl ? <section className="content-grid"><article className="panel"><div className="panel-title"><h2>Pay by UPI</h2></div><img src={qrUrl} alt="Monthly payment QR code" style={{ maxWidth: 280, width: "100%", height: "auto" }} /></article><article className="panel"><div className="panel-title"><h2>Instructions</h2></div><p style={{ whiteSpace: "pre-wrap" }}>{settingsResult.settings?.instructions || "Use the QR code above, then submit the payment details below."}</p></article></section> : <section className="panel"><div className="empty-state"><strong>QR code not available</strong><p>Monthly payment details will be available after the Admin uploads the current QR code.</p></div></section>}
      {qrUrl ? <section className="panel narrow-panel section-gap"><div className="panel-title"><div><h2>Submit payment</h2><span>UTR and amount are checked before review.</span></div></div><StudentPaymentForm /></section> : null}
      <section className="panel section-gap"><div className="panel-title"><h2>Payment history</h2><span>{paymentsResult.payments.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Fee month</th><th>Amount</th><th>Paid on</th><th>UTR</th><th>Status</th><th>Review note</th></tr></thead><tbody>{paymentsResult.payments.map((payment) => <tr key={payment.id}><td>{displayDate(payment.fee_month)}</td><td>{formatInr(payment.amount_paise)}</td><td>{displayDate(payment.payment_date)}</td><td>{payment.utr}</td><td><span className={`status-pill status-${payment.status === "verified" ? "success" : payment.status === "rejected" ? "danger" : "warning"}`}>{payment.status}</span></td><td>{payment.rejection_reason ?? "—"}</td></tr>)}</tbody></table>{!paymentsResult.payments.length ? <div className="empty-state"><strong>No payments yet</strong><p>Your submitted payments will appear here.</p></div> : null}</div></section>
      {paymentsResult.payments.filter((payment) => payment.status !== "verified").map((payment) => <section className="panel section-gap" key={`edit-${payment.id}`}><div className="panel-title"><div><h2>{payment.status === "rejected" ? "Correct rejected payment" : "Edit pending payment"}</h2><span>{payment.status === "rejected" ? payment.rejection_reason : "Update details before review."}</span></div></div><StudentPaymentForm payment={payment} /></section>)}
    </>}
  </main>;
}
