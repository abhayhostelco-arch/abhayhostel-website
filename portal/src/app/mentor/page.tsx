import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, Users } from "lucide-react";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { TrendChart } from "@/components/trend-chart";
import { deriveAlerts } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";
import { getAlertSettings, getEntries, getProfiles, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";

export default async function MentorDashboard() {
  const mentor = await requireProfile(["admin"]);
  const start = daysAgoInIndia(6); const today = todayInIndia();
  const [students, entries, alertsSettings, settings, globalSource] = await Promise.all([getProfiles("student"), getEntries({ startDate: start }), getAlertSettings(), getScoreSettings(), getStudentLeaderboardSource(start)]);
  const active = students.filter((student) => student.is_active);
  const todayEntries = entries.filter((entry) => entry.entry_date === today);
  const alerts = deriveAlerts(active, entries, alertsSettings, 7).slice(0, 6);
  const globalReport = buildGrowthReport(globalSource.students, globalSource.entries, settings, 7);
  const chartData = Array.from({ length: 7 }, (_, index) => { const date = daysAgoInIndia(6 - index); const count = entries.filter((entry) => entry.entry_date === date).length; return { date: date.slice(5), completion: active.length ? Math.round(count / active.length * 100) : 0 }; });
  return <main className="page-container"><header className="page-heading hero-heading"><div><p className="eyebrow">Mentor Workspace</p><h1>Welcome, {mentor.full_name.split(" ")[0]}</h1><p>Review assigned Students and respond to missed entries early.</p></div><Link className="button" href="/mentor/students">View My Students</Link></header><section className="metric-grid"><article className="metric-card"><span><Users size={15} aria-hidden="true" /> Assigned Students</span><strong>{active.length}</strong></article><article className="metric-card"><span><CheckCircle2 size={15} aria-hidden="true" /> Submitted Today</span><strong>{todayEntries.length}</strong></article><article className="metric-card"><span><Clock3 size={15} aria-hidden="true" /> Missing Today</span><strong>{Math.max(active.length - todayEntries.length, 0)}</strong></article><article className="metric-card"><span><BellRing size={15} aria-hidden="true" /> 7-Day Alerts</span><strong>{deriveAlerts(active, entries, alertsSettings, 7).length}</strong></article></section><section className="dashboard-grid section-gap"><article className="panel"><div className="panel-title"><h2>Assigned-Group Completion</h2></div><TrendChart data={chartData} mode="completion" /></article><article className="panel"><div className="panel-title"><h2>Students Needing Attention</h2><Link href="/mentor/alerts">All Alerts</Link></div><div className="alert-list">{alerts.map((alert) => <div className="alert-item" key={alert.id}><BellRing size={18} aria-hidden="true" /><div><strong>{alert.studentName}</strong><span>{alert.date} · {alert.message}</span></div></div>)}{!alerts.length ? <div className="empty-state"><strong>No Recent Alerts</strong><p>Assigned Students are currently on track.</p></div> : null}</div></article></section><section className="panel section-gap"><div className="panel-title"><div><p className="eyebrow">Hostel Scoreboard</p><h2>Top 10 · Rolling 7 Days</h2></div></div><GrowthLeaderboard students={globalReport.students.slice(0, 10)} /></section></main>;
}
