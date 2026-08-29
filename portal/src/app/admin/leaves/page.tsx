import type { Metadata } from "next";
import Link from "next/link";
import { DashboardMetric } from "@/components/dashboard-ui";
import { LeaveDecisionControls } from "@/components/leave-decision-controls";
import { CalendarDays, Clock3, House, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { approvedLeaveDaysInMonth, displayDate, leaveDays, todayInIndia } from "@/lib/date";
import { getLeaveRequests, getPrivateUploadSignedUrl, getProfiles } from "@/lib/data";
import { studentProfilePath } from "@/lib/roles";
import type { LeaveStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Home leave management" };

export default async function LeaveManagementPage({ searchParams }: { searchParams: Promise<{ month?: string; studentId?: string; status?: string }> }) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : todayInIndia().slice(0, 7);
  const validStatuses: LeaveStatus[] = ["pending", "approved", "rejected", "withdrawn"];
  const status = validStatuses.includes(params.status as LeaveStatus) ? params.status as LeaveStatus : undefined;
  const students = await getProfiles("student", true);
  const studentId = students.some((student) => student.id === params.studentId) ? params.studentId : undefined;
  const result = await getLeaveRequests({ month, studentId, status });
  const urls = new Map(await Promise.all(result.requests.filter((request) => request.attachment_path).map(async (request) => [request.id, await getPrivateUploadSignedUrl("leave-applications", request.attachment_path)] as const)));
  const today = todayInIndia();
  const approved = result.requests.filter((request) => request.status === "approved");
  const awayToday = new Set(approved.filter((request) => request.start_date <= today && request.end_date >= today).map((request) => request.student_id)).size;
  const totalHomeDays = approvedLeaveDaysInMonth(approved, month);
  return <main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">Operations</p><h1>{actor.role === "super_admin" ? "Home Leave Management" : "Assigned Students’ Leave"}</h1><p>{actor.role === "super_admin" ? "Review applications and track approved days at home." : "Monitor leave for your assigned Students. Admin makes all decisions."}</p></div></header>
    {!result.available ? <section className="panel"><div className="empty-state unavailable-state"><strong>Leave Management Unavailable</strong><p>Apply the supplied database migration to enable this feature.</p></div></section> : <>
      <section className="dashboard-kpi-grid dashboard-kpi-four"><DashboardMetric label="Pending" value={result.requests.filter((request) => request.status === "pending").length} detail="Need Admin Review" icon={Clock3} tone="orange" /><DashboardMetric label="Away Today" value={awayToday} detail="Approved Leave" icon={House} tone="purple" /><DashboardMetric label="Home Days" value={totalHomeDays} detail={month} icon={CalendarDays} tone="blue" /><DashboardMetric label="Students" value={new Set(result.requests.map((request) => request.student_id)).size} detail="In Selected View" icon={Users} tone="green" /></section>
      <section className="panel section-gap-small"><form className="filters"><div className="field"><label htmlFor="leaveMonth">Month</label><input id="leaveMonth" name="month" type="month" defaultValue={month} /></div><div className="field"><label htmlFor="leaveStudent">Student</label><select id="leaveStudent" name="studentId" defaultValue={studentId ?? ""}><option value="">All Students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></div><div className="field"><label htmlFor="leaveStatus">Status</label><select id="leaveStatus" name="status" defaultValue={status ?? ""}><option value="">All Statuses</option>{validStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><button className="button button-secondary">Apply Filters</button></form></section>
      <section className="panel section-gap"><div className="panel-title"><h2>Leave Applications</h2><span>{result.requests.length} requests</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Dates</th><th>Leave Days</th><th>Reason</th><th>Application</th><th>Status / Decision</th></tr></thead><tbody>{result.requests.map((request) => { const student = students.find((item) => item.id === request.student_id); return <tr key={request.id}><td>{student ? <Link className="table-primary-link" href={studentProfilePath(actor.role === "super_admin" ? "super_admin" : "admin", student.id)}>{student.full_name}</Link> : "Student"}</td><td>{displayDate(request.start_date)} – {displayDate(request.end_date)}</td><td>{leaveDays(request)}</td><td>{request.reason}</td><td>{urls.get(request.id) ? <a href={urls.get(request.id)!} target="_blank" rel="noreferrer">View</a> : "—"}</td><td><LeaveDecisionControls requestId={request.id} studentName={student?.full_name ?? "student"} status={request.status} decisionNote={request.decision_note} canDecide={actor.role === "super_admin"} /></td></tr>; })}</tbody></table>{!result.requests.length ? <div className="empty-state"><strong>No Leave Requests</strong><p>No applications match these filters.</p></div> : null}</div></section>
    </>}
  </main>;
}
