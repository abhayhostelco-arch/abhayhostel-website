import { decideLeaveRequestAction } from "@/app/actions/leave";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { LeaveStatus } from "@/lib/types";

export function LeaveDecisionControls({
  requestId,
  studentName,
  status,
  decisionNote,
  canDecide,
}: {
  requestId: string;
  studentName: string;
  status: LeaveStatus;
  decisionNote: string | null;
  canDecide: boolean;
}) {
  if (status === "pending" && canDecide) {
    return <div className="leave-decision-actions"><form action={decideLeaveRequestAction}><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="decision" value="approved" /><input type="hidden" name="decisionNote" value="" /><FormSubmitButton className="button button-small" pendingLabel="Approving…">Approve</FormSubmitButton></form><form action={decideLeaveRequestAction} className="inline-reject-form"><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="decision" value="rejected" /><input name="decisionNote" maxLength={1000} required placeholder="Reason for rejection" aria-label={`Reason for rejecting ${studentName}`} /><FormSubmitButton className="button button-danger button-small" pendingLabel="Rejecting…">Reject</FormSubmitButton></form></div>;
  }
  if (status === "approved" && canDecide) {
    return <div className="leave-decision-actions"><span className="status-pill status-success">approved</span><form action={decideLeaveRequestAction} className="inline-reject-form"><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="decision" value="rejected" /><input name="decisionNote" maxLength={1000} required placeholder="Reason for rejection" aria-label={`Reason for rejecting ${studentName}`} /><FormSubmitButton className="button button-danger button-small" pendingLabel="Rejecting…">Reject</FormSubmitButton></form></div>;
  }
  return <div><span className={`status-pill status-${status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"}`}>{status}</span>{decisionNote ? <small className="decision-note">{decisionNote}</small> : null}</div>;
}
