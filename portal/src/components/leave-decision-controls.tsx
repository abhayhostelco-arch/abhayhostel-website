"use client";

import { useActionState } from "react";
import { decideLeaveRequestAction, retryLeaveNotificationAction } from "@/app/actions/leave";
import { FormSubmitButton } from "@/components/form-submit-button";
import { initialActionState, type LeaveNotificationStatus, type LeaveStatus } from "@/lib/types";

export function LeaveDecisionControls({
  requestId,
  studentName,
  status,
  decisionNote,
  canDecide,
  notificationId,
  notificationStatus,
  canRetry = false,
}: {
  requestId: string;
  studentName: string;
  status: LeaveStatus;
  decisionNote: string | null;
  canDecide: boolean;
  notificationId?: string;
  notificationStatus?: LeaveNotificationStatus;
  canRetry?: boolean;
}) {
  const [decisionState, decisionAction] = useActionState(decideLeaveRequestAction, initialActionState);
  const [retryState, retryAction] = useActionState(retryLeaveNotificationAction, initialActionState);
  const message = retryState.message ?? decisionState.message;
  const messageStatus = retryState.message ? retryState.status : decisionState.status;
  const result = message ? <p className={`form-message ${messageStatus === "success" ? "form-success" : "form-error"}`} role={messageStatus === "success" ? "status" : "alert"}>{message}</p> : null;
  const retry = canRetry && notificationStatus === "failed" && notificationId ? <form action={retryAction}><input type="hidden" name="notificationId" value={notificationId} /><FormSubmitButton className="button button-secondary button-small" pendingLabel="Retrying email…">Retry email</FormSubmitButton></form> : null;
  if (status === "pending" && canDecide) {
    return <div className="leave-decision-actions"><form action={decisionAction}><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="expectedStatus" value="pending" /><input type="hidden" name="decision" value="approved" /><input type="hidden" name="decisionNote" value="" /><FormSubmitButton className="button button-small" pendingLabel="Approving…">Approve</FormSubmitButton></form><form action={decisionAction} className="inline-reject-form"><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="expectedStatus" value="pending" /><input type="hidden" name="decision" value="rejected" /><input name="decisionNote" maxLength={1000} required placeholder="Reason for rejection" aria-label={`Reason for rejecting ${studentName}`} /><FormSubmitButton className="button button-danger button-small" pendingLabel="Rejecting…">Reject</FormSubmitButton></form>{result}</div>;
  }
  if (status === "approved" && canDecide) {
    return <div className="leave-decision-actions"><span className="status-pill status-success">approved</span><form action={decisionAction} className="inline-reject-form"><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="expectedStatus" value="approved" /><input type="hidden" name="decision" value="rejected" /><input name="decisionNote" maxLength={1000} required placeholder="Reason for rejection" aria-label={`Reason for rejecting ${studentName}`} /><FormSubmitButton className="button button-danger button-small" pendingLabel="Rejecting…">Reject</FormSubmitButton></form>{retry}{result}</div>;
  }
  return <div><span className={`status-pill status-${status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"}`}>{status}</span>{decisionNote ? <small className="decision-note">{decisionNote}</small> : null}{retry}{result}</div>;
}
