import type { Metadata } from "next";
import { WeeklyCategoryChart } from "@/components/growth-score-charts";
import { StudentPerformanceTable } from "@/components/student-performance-table";
import { DashboardPanel } from "@/components/dashboard-ui";
import { requireProfile } from "@/lib/auth";
import { approvedLeaveDaysInMonth, daysAgoInIndia, todayInIndia } from "@/lib/date";
import { getEntries, getLeaveRequests, getProfiles, getScoreSettings } from "@/lib/data";
import { buildGrowthReport, buildWeeklyCategorySeries } from "@/lib/growth-score";

export const metadata: Metadata = { title: "Daily tracking" };

export default async function DailyTrackingPage({ searchParams }: { searchParams: Promise<{ range?: string; studentId?: string }> }) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const params = await searchParams;
  const range = params.range === "7" || params.range === "90" ? Number(params.range) : 30;
  const students = await getProfiles("student", true);
  const studentId = students.some((student) => student.id === params.studentId) ? params.studentId : undefined;
  const start = daysAgoInIndia(range - 1);
  const [entries, settings, leaves] = await Promise.all([
    getEntries({ startDate: start, studentIds: students.map((student) => student.id) }), getScoreSettings(), getLeaveRequests({ month: todayInIndia().slice(0, 7) }),
  ]);
  const report = buildGrowthReport(students, entries, settings, range);
  const selected = studentId ? report.students.filter((student) => student.studentId === studentId) : report.students;
  const homeDays = new Map(students.map((student) => [student.id, approvedLeaveDaysInMonth(leaves.requests.filter((request) => request.student_id === student.id), todayInIndia().slice(0, 7))]));
  const base = actor.role === "super_admin" ? "/admin/students" : "/mentor/students";
  return <main className="page-container">
    <header className="page-heading"><div><p className="eyebrow">Insights</p><h1>Daily Tracking</h1><p>Review individual or group Daily Entry performance in one glance.</p></div></header>
    <section className="panel"><form className="filters"><div className="field"><label htmlFor="trackingRange">Range</label><select id="trackingRange" name="range" defaultValue={String(range)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div><div className="field"><label htmlFor="trackingStudent">Student</label><select id="trackingStudent" name="studentId" defaultValue={studentId ?? ""}><option value="">All Students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></div><button className="button button-secondary">Update Tracking</button></form></section>
    <DashboardPanel title="Weekly Progress" description={studentId ? `${selected[0]?.studentName ?? "Student"} · Last 7 eligible days` : "Assigned-group average · Last 7 eligible days"} className="section-gap dashboard-wide-panel"><WeeklyCategoryChart data={buildWeeklyCategorySeries(report, studentId)} /></DashboardPanel>
    <DashboardPanel title="Students at a Glance" description={`${range}-day scores · Approved home days this month`} className="section-gap"><StudentPerformanceTable students={selected} homeDays={homeDays} hrefBase={base} /></DashboardPanel>
    {!leaves.available ? <p className="security-note section-gap">Home-day totals will appear after the leave-management migration is applied.</p> : null}
  </main>;
}
