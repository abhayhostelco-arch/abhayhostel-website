import Link from "next/link";
import { PaymentReviewControls } from "@/components/payment-review-controls";
import { requireProfile } from "@/lib/auth";
import { displayDate } from "@/lib/date";
import { getProfiles, getStudentPayments } from "@/lib/data";
import { formatInr } from "@/lib/payments";
import { studentProfilePath } from "@/lib/roles";

export async function PaymentReviewPage() {
  const actor = await requireProfile(["super_admin", "admin"]);
  const [paymentResult, students] = await Promise.all([getStudentPayments(), getProfiles("student", true)]);
  return <main className="page-container"><header className="page-heading"><div><p className="eyebrow">Monthly fee</p><h1>{actor.role === "super_admin" ? "Payment Review" : "Assigned Student Payments"}</h1><p>{actor.role === "super_admin" ? "Review payment submissions across all Students." : "Review payments only for Students currently assigned to you."}</p></div>{actor.role === "super_admin" ? <div className="heading-actions"><Link className="payment-settings-link" href="/admin/settings#payments">Update payment settings →</Link></div> : null}</header>{!paymentResult.available ? <section className="panel"><div className="empty-state unavailable-state"><strong>Payments Unavailable</strong><p>Apply the supplied database migration to enable monthly payments.</p></div></section> : <section className="panel"><div className="panel-title"><h2>Payment submissions</h2><span>{paymentResult.payments.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Month</th><th>Amount</th><th>Paid on</th><th>UTR</th><th>Note</th><th>Review</th></tr></thead><tbody>{paymentResult.payments.map((payment) => { const student = students.find((item) => item.id === payment.student_id); return <tr key={payment.id}><td>{student ? <Link className="table-primary-link" href={studentProfilePath(actor.role === "super_admin" ? "super_admin" : "admin", student.id)}>{student.full_name}</Link> : "Student"}</td><td>{displayDate(payment.fee_month)}</td><td>{formatInr(payment.amount_paise)}</td><td>{displayDate(payment.payment_date)}</td><td>{payment.utr}</td><td>{payment.note ?? "—"}</td><td><PaymentReviewControls payment={payment} /></td></tr>; })}</tbody></table>{!paymentResult.payments.length ? <div className="empty-state"><strong>No payment submissions</strong><p>Payments from your authorized view will appear here.</p></div> : null}</div></section>}</main>;
}
