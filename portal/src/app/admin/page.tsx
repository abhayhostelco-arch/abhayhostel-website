import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CheckCircle2, ClipboardCheck, ShieldCheck, UserRoundX, Users } from "lucide-react";
import { CategoryLeaderboard } from "@/components/category-leaderboard";
import { TrendChart } from "@/components/trend-chart";
import { deriveAlerts } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";
import { getAlertSettings, getEntries, getGitaAttendance, getProfiles, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";
import { summarizeAttendanceDays } from "@/lib/gita-attendance";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ mentorId?: string }> }) {
  await requireProfile(["super_admin"]);
  const { mentorId } = await searchParams;
  const start = daysAgoInIndia(29);
  const today = todayInIndia();
  const [active, mentors, alertsSettings, scoreSettings, source] = await Promise.all([
    getProfiles("student", true), getProfiles("admin", true), getAlertSettings(), getScoreSettings(), getStudentLeaderboardSource(start),
  ]);
  const report = buildGrowthReport(source.students, source.entries, scoreSettings, 30);
  const allowedMentor = mentors.some((mentor) => mentor.id === mentorId) ? mentorId : undefined;
  const poolIds = new Set(active.filter((student) => !allowedMentor || student.mentor_id === allowedMentor).map((student) => student.id));
  const entries = await getEntries({ startDate: start, studentIds: [...poolIds] });
  const scopedReport = report.students.filter((student) => poolIds.has(student.studentId));
  const todayEntries = entries.filter((entry) => entry.entry_date === today && poolIds.has(entry.student_id));
  const scopedStudents = active.filter((student) => poolIds.has(student.id));
  const alerts = deriveAlerts(scopedStudents, entries, alertsSettings, 30).slice(0, 6);
  const attendance = await getGitaAttendance(start, [...poolIds]);
  const dates = Array.from({ length: 30 }, (_, index) => daysAgoInIndia(29 - index));
  const attendanceDays = summarizeAttendanceDays(dates, [...poolIds], attendance.records);
  const todayAttendance = attendanceDays.find((day) => day.date === today);
  const chartData = attendanceDays.map((day) => ({ date: day.date.slice(5), studentsPresent: attendance.available ? day.present : null }));
  return <main className="page-container">
    <header className="page-heading hero-heading"><div><p className="eyebrow">Overview</p><h1>Hostel Operations</h1><p>Monitor assignments, submissions, alerts, and student growth.</p></div><div className="heading-actions"><Link className="button button-secondary" href="/admin/reports?range=30">30-Day Reports</Link><Link className="button" href="/admin/students/new">Add Student</Link></div></header>
    <section className="metric-grid metric-grid-six"><article className="metric-card"><span><Users size={15} aria-hidden="true" /> Active Students</span><strong>{active.length}</strong></article><article className="metric-card"><span><ShieldCheck size={15} aria-hidden="true" /> Mentors</span><strong>{mentors.filter((m) => m.is_active).length}</strong></article><article className="metric-card"><span><CheckCircle2 size={15} aria-hidden="true" /> Submitted Today</span><strong>{todayEntries.length}</strong></article><article className="metric-card metric-card-accent"><span><Users size={15} aria-hidden="true" /> Students Present Today</span><strong>{attendance.available ? (todayAttendance?.present ?? "—") : "—"}</strong></article><article className="metric-card"><span><ClipboardCheck size={15} aria-hidden="true" /> Attendance Complete</span><strong>{attendance.available ? `${todayAttendance?.recorded ?? 0}/${todayAttendance?.expected ?? scopedStudents.length}` : "—"}</strong></article><article className="metric-card"><span><UserRoundX size={15} aria-hidden="true" /> Unassigned</span><strong>{active.filter((student) => !student.mentor_id).length}</strong></article></section>
    <section className="dashboard-grid section-gap"><article className="panel"><div className="panel-title"><div><h2>Students Present · Last 30 Days</h2><span>Unrecorded dates remain gaps.</span></div><Link href="/admin/gita-attendance">Record Attendance</Link></div>{attendance.available ? <TrendChart data={chartData} mode="attendance" /> : <div className="empty-state unavailable-state"><strong>Attendance analytics unavailable</strong><p>Apply the supplied migration to enable the official register.</p></div>}</article><article className="panel"><div className="panel-title"><h2>Mentor Workload</h2><Link href="/admin/administrators">Manage Mentors</Link></div><div className="workload-list">{mentors.map((mentor) => { const count = active.filter((student) => student.mentor_id === mentor.id).length; return <div key={mentor.id}><span>{mentor.full_name}</span><strong>{count} {count === 1 ? "student" : "students"}</strong></div>; })}{!mentors.length ? <div className="empty-state"><strong>No Mentors Yet</strong><p>Create a Mentor before assigning Students.</p></div> : null}</div></article></section>
    <section className="panel section-gap"><div className="panel-title"><div><p className="eyebrow">Hostel scoreboard</p><h2>Top 10 · rolling 30 days</h2></div><form className="filters compact-filter" method="get"><div className="field"><label htmlFor="mentorId">Mentor</label><select id="mentorId" name="mentorId" defaultValue={allowedMentor ?? ""}><option value="">All Mentors</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>)}</select></div><button className="button button-secondary button-small">Apply</button></form></div><CategoryLeaderboard students={scopedReport} /></section>
    <section className="panel section-gap"><div className="panel-title"><h2>Latest alerts</h2><Link href="/admin/alerts">View all</Link></div><div className="alert-list">{alerts.map((alert) => <div className="alert-item" key={alert.id}><BellRing size={18} aria-hidden="true" /><div><strong>{alert.studentName}</strong><span>{alert.date} · {alert.message}</span></div></div>)}{!alerts.length ? <p className="empty-state">No recent alerts.</p> : null}</div></section>
  </main>;
}
