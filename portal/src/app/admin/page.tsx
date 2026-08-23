import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, ShieldCheck, UserRoundX, Users } from "lucide-react";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { TrendChart } from "@/components/trend-chart";
import { deriveAlerts } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";
import { getAlertSettings, getEntries, getProfiles, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ mentorId?: string }> }) {
  await requireProfile(["super_admin"]);
  const { mentorId } = await searchParams;
  const start = daysAgoInIndia(6);
  const today = todayInIndia();
  const [active, mentors, alertsSettings, scoreSettings, source] = await Promise.all([
    getProfiles("student", true), getProfiles("admin", true), getAlertSettings(), getScoreSettings(), getStudentLeaderboardSource(start),
  ]);
  const report = buildGrowthReport(source.students, source.entries, scoreSettings, 7);
  const allowedMentor = mentors.some((mentor) => mentor.id === mentorId) ? mentorId : undefined;
  const poolIds = new Set(active.filter((student) => !allowedMentor || student.mentor_id === allowedMentor).map((student) => student.id));
  const entries = await getEntries({ startDate: start, studentIds: [...poolIds] });
  const ranked = report.students.filter((student) => poolIds.has(student.studentId)).slice(0, 10);
  const todayEntries = entries.filter((entry) => entry.entry_date === today && poolIds.has(entry.student_id));
  const scopedStudents = active.filter((student) => poolIds.has(student.id));
  const alerts = deriveAlerts(scopedStudents, entries, alertsSettings, 7).slice(0, 6);
  const chartData = Array.from({ length: 7 }, (_, index) => { const date = daysAgoInIndia(6 - index); const count = entries.filter((entry) => entry.entry_date === date && poolIds.has(entry.student_id)).length; return { date: date.slice(5), completion: scopedStudents.length ? Math.round(count / scopedStudents.length * 100) : 0 }; });
  return <main className="page-container">
    <header className="page-heading hero-heading"><div><p className="eyebrow">Overview</p><h1>Hostel Operations</h1><p>Monitor assignments, submissions, alerts, and student growth.</p></div><Link className="button" href="/admin/students/new">Add Student</Link></header>
    <section className="metric-grid metric-grid-five"><article className="metric-card"><span><Users size={15} aria-hidden="true" /> Active Students</span><strong>{active.length}</strong></article><article className="metric-card"><span><ShieldCheck size={15} aria-hidden="true" /> Mentors</span><strong>{mentors.filter((m) => m.is_active).length}</strong></article><article className="metric-card"><span><CheckCircle2 size={15} aria-hidden="true" /> Submitted Today</span><strong>{todayEntries.length}</strong></article><article className="metric-card"><span><Clock3 size={15} aria-hidden="true" /> Missing Today</span><strong>{Math.max(scopedStudents.length - todayEntries.length, 0)}</strong></article><article className="metric-card"><span><UserRoundX size={15} aria-hidden="true" /> Unassigned</span><strong>{active.filter((student) => !student.mentor_id).length}</strong></article></section>
    <section className="dashboard-grid section-gap"><article className="panel"><div className="panel-title"><h2>7-Day Submission Trend</h2></div><TrendChart data={chartData} mode="completion" /></article><article className="panel"><div className="panel-title"><h2>Mentor Workload</h2><Link href="/admin/administrators">Manage Mentors</Link></div><div className="workload-list">{mentors.map((mentor) => { const count = active.filter((student) => student.mentor_id === mentor.id).length; return <div key={mentor.id}><span>{mentor.full_name}</span><strong>{count} {count === 1 ? "student" : "students"}</strong></div>; })}{!mentors.length ? <div className="empty-state"><strong>No Mentors Yet</strong><p>Create a Mentor before assigning Students.</p></div> : null}</div></article></section>
    <section className="panel section-gap"><div className="panel-title"><div><p className="eyebrow">Hostel scoreboard</p><h2>Top 10 · rolling 7 days</h2></div><form className="filters compact-filter" method="get"><div className="field"><label htmlFor="mentorId">Mentor</label><select id="mentorId" name="mentorId" defaultValue={allowedMentor ?? ""}><option value="">All Mentors</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>)}</select></div><button className="button button-secondary button-small">Apply</button></form></div><GrowthLeaderboard students={ranked} /></section>
    <section className="panel section-gap"><div className="panel-title"><h2>Latest alerts</h2><Link href="/admin/alerts">View all</Link></div><div className="alert-list">{alerts.map((alert) => <div className="alert-item" key={alert.id}><BellRing size={18} aria-hidden="true" /><div><strong>{alert.studentName}</strong><span>{alert.date} · {alert.message}</span></div></div>)}{!alerts.length ? <p className="empty-state">No recent alerts.</p> : null}</div></section>
  </main>;
}
