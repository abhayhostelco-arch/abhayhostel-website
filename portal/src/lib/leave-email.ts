import "server-only";
import { z } from "zod";

export type LeaveDecisionEmailSnapshot = {
  id: string;
  leave_request_id: string;
  decision_version: number;
  decision: "approved" | "rejected";
  recipient_email: string | null;
  student_name: string;
  leave_start_date: string;
  leave_end_date: string;
  decision_note: string | null;
  idempotency_key: string;
};

const recipientEmailSchema = z.string().email();

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function leaveEmailConfig() {
  const parsed = z.object({
    RESEND_API_KEY: z.string().min(1),
    LEAVE_EMAIL_FROM: z.string().min(3).max(320),
  }).safeParse(process.env);
  if (!parsed.success) throw new Error("leave email is not configured");
  return parsed.data;
}

export function buildLeaveDecisionEmail(snapshot: LeaveDecisionEmailSnapshot, appUrl: string) {
  const decision = snapshot.decision === "approved" ? "approved" : "rejected";
  const portalUrl = new URL("/student/leave", appUrl).toString();
  const dates = `${displayDate(snapshot.leave_start_date)} to ${displayDate(snapshot.leave_end_date)}`;
  const reason = snapshot.decision === "rejected" && snapshot.decision_note ? `\nReason: ${snapshot.decision_note}` : "";
  const htmlReason = snapshot.decision === "rejected" && snapshot.decision_note ? `<p><strong>Reason:</strong> ${escapeHtml(snapshot.decision_note)}</p>` : "";
  return {
    subject: `Your leave request was ${decision}`,
    text: `Hello ${snapshot.student_name},\n\nYour leave request for ${dates} was ${decision}.${reason}\n\nView your leave request: ${portalUrl}`,
    html: `<p>Hello ${escapeHtml(snapshot.student_name)},</p><p>Your leave request for <strong>${escapeHtml(dates)}</strong> was <strong>${decision}</strong>.</p>${htmlReason}<p><a href="${escapeHtml(portalUrl)}">View your leave request</a></p>`,
  };
}

export async function sendLeaveDecisionEmail(snapshot: LeaveDecisionEmailSnapshot, appUrl: string): Promise<{ id: string }> {
  if (!recipientEmailSchema.safeParse(snapshot.recipient_email).success) throw new Error("recipient email is missing or invalid");
  const config = leaveEmailConfig();
  const message = buildLeaveDecisionEmail(snapshot, appUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": snapshot.idempotency_key,
    },
    body: JSON.stringify({ from: config.LEAVE_EMAIL_FROM, to: [snapshot.recipient_email], subject: message.subject, html: message.html, text: message.text }),
  });
  if (!response.ok) throw new Error(`Resend delivery failed (${response.status})`);
  const body = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || !body.id) throw new Error("Resend did not return a message id");
  return { id: body.id };
}
