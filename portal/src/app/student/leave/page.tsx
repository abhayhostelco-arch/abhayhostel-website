import type { Metadata } from "next";
import { withdrawLeaveRequestAction } from "@/app/actions/leave";
import { LeaveRequestForm } from "@/components/leave-request-form";
import { requireProfile } from "@/lib/auth";
import { canWithdrawLeaveRequest, displayDate, todayInIndia } from "@/lib/date";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getLeaveRequests, getPrivateUploadSignedUrl } from "@/lib/data";

export const metadata: Metadata = { title: "My home leave" };

export default async function StudentLeavePage() {
  const profile = await requireProfile(["student"]);
  const today = todayInIndia();
  const result = await getLeaveRequests({ studentId: profile.id });
  const attachmentUrls = new Map(await Promise.all(result.requests.filter((request) => request.attachment_path).map(async (request) => [request.id, await getPrivateUploadSignedUrl("leave-applications", request.attachment_path)] as const)));
  return <main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">Home Leave</p><h1>My Leave Applications</h1><p>Request permission before going home and follow the Admin’s decision here.</p></div></header>
    {!result.available ? <section className="panel"><div className="empty-state unavailable-state"><strong>Leave Applications Unavailable</strong><p>Apply the supplied database migration to enable this feature.</p></div></section> : <>
      <section className="panel narrow-panel"><div className="panel-title"><div><h2>New Application</h2><span>Attachments are optional.</span></div></div><LeaveRequestForm studentId={profile.id} minDate={today} /></section>
      <section className="panel section-gap"><div className="panel-title"><h2>Application History</h2><span>{result.requests.length} requests</span></div><div className="table-wrap"><table><thead><tr><th>Dates</th><th>Reason</th><th>Status</th><th>Admin Note</th><th>Application</th><th>Action</th></tr></thead><tbody>{result.requests.map((request) => <tr key={request.id}><td>{displayDate(request.start_date)} – {displayDate(request.end_date)}</td><td>{request.reason}</td><td><span className={`status-pill status-${request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "warning"}`}>{request.status}</span></td><td>{request.decision_note ?? "—"}</td><td>{attachmentUrls.get(request.id) ? <a href={attachmentUrls.get(request.id)!} target="_blank" rel="noreferrer">View</a> : "—"}</td><td>{canWithdrawLeaveRequest(request) ? <form action={withdrawLeaveRequestAction}><input type="hidden" name="requestId" value={request.id} /><FormSubmitButton className="button button-secondary button-small" pendingLabel="Withdrawing…">Withdraw</FormSubmitButton></form> : "—"}</td></tr>)}</tbody></table>{!result.requests.length ? <div className="empty-state"><strong>No Leave Applications</strong><p>Your applications will appear here.</p></div> : null}</div></section>
    </>}
  </main>;
}
