import Link from "next/link";
import { BellRing, BookOpen, CheckCircle2, Clock3, ClipboardCheck, Sparkles, Users } from "lucide-react";
import { ActivityList, AttendanceHeatmap, DashboardMetric, DashboardPanel, ScoreOverview, StudentSummaryStrip, type ActivityItem } from "@/components/dashboard-ui";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { TrendChart } from "@/components/trend-chart";
import { deriveAlerts } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate, todayInIndia } from "@/lib/date";
import { getAlertSettings, getEntries, getProfiles, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";

export default async function MentorDashboard() {
  const mentor = await requireProfile(["admin"]);
  const start = daysAgoInIndia(29); const today = todayInIndia();
  const active = await getProfiles("student", true);
  const [entries, alertsSettings, settings, globalSource] = await Promise.all([getEntries({ startDate: start, studentIds: active.map((student) => student.id) }), getAlertSettings(), getScoreSettings(), getStudentLeaderboardSource(start)]);
  const todayEntries = entries.filter((entry) => entry.entry_date === today);
  const alerts = deriveAlerts(active, entries, alertsSettings, 30).slice(0, 6);
  const allAlerts = deriveAlerts(active, entries, alertsSettings, 30);
  const globalReport = buildGrowthReport(globalSource.students, globalSource.entries, settings, 30);
  const chartData = Array.from({ length: 30 }, (_, index) => { const date = daysAgoInIndia(29 - index); const count = entries.filter((entry) => entry.entry_date === date).length; return { date: date.slice(5), completion: active.length ? Math.round(count / active.length * 100) : 0 }; });
  const heatmapDays = chartData.slice(-7).map((day, index) => ({
    date: daysAgoInIndia(6 - index),
    label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${daysAgoInIndia(6 - index)}T12:00:00+05:30`)),
    value: active.length ? day.completion ?? 0 : null,
    detail: active.length ? `${entries.filter((entry) => entry.entry_date === daysAgoInIndia(6 - index)).length}/${active.length} Submitted` : "No Students",
  }));
  const activityItems: ActivityItem[] = [
    ...todayEntries.slice(0, 3).map((entry) => ({ id: `entry-${entry.id}`, title: "Daily Entry Submitted", description: active.find((student) => student.id === entry.student_id)?.full_name ?? "Student", meta: "Today", icon: ClipboardCheck, tone: "blue" as const })),
    ...alerts.slice(0, 3).map((alert) => ({ id: `alert-${alert.id}`, title: "Student Needs Attention", description: `${alert.studentName} · ${alert.message}`, meta: displayDate(alert.date), icon: BellRing, tone: "rose" as const })),
  ].slice(0, 5);
  return <main className="page-container">
    <header className="page-heading dashboard-heading"><div><p className="eyebrow">Mentor Workspace</p><h1>Hare Krishna, {mentor.full_name.split(" ")[0]} 🙏</h1><p>Review assigned Students and respond to missed entries early.</p></div><div className="heading-actions"><Link className="button button-secondary" href="/mentor/reports?range=30">30-Day Reports</Link><Link className="button" href="/mentor/students">View My Students</Link></div></header>
    <section className="dashboard-kpi-grid dashboard-kpi-five" aria-label="Assigned-group summary">
      <DashboardMetric label="Assigned Students" value={active.length} detail="Active Students" icon={Users} tone="purple" />
      <DashboardMetric label="Submitted Today" value={todayEntries.length} detail="Daily Entries" icon={CheckCircle2} tone="green" />
      <DashboardMetric label="Missing Today" value={Math.max(active.length - todayEntries.length, 0)} detail="Need a Reminder" icon={Clock3} tone="orange" />
      <DashboardMetric label="30-Day Alerts" value={allAlerts.length} detail="Routine Observations" icon={BellRing} tone="rose" />
      <DashboardMetric label="Group Growth" value={`${Math.round(globalReport.averages.overall)}/100`} detail="Rolling 30 Days" icon={Sparkles} tone="blue" />
    </section>
    <section className="dashboard-reference-grid section-gap">
      <DashboardPanel title="Assigned-Group Completion" description="Daily submission percentage · Last 30 days" className="dashboard-wide-panel"><TrendChart data={chartData} mode="completion" /></DashboardPanel>
      <DashboardPanel title="Weekly Completion" description="Recent Daily Entry consistency"><AttendanceHeatmap days={heatmapDays} /></DashboardPanel>
      <DashboardPanel title="Group Progress" description="Rolling 30-day category average" className="score-panel"><ScoreOverview scores={globalReport.averages} /></DashboardPanel>
      <DashboardPanel title="Students Needing Attention" description="Latest assigned-group alerts" action={<Link href="/mentor/alerts?range=30">All Alerts</Link>}><div className="alert-list">{alerts.map((alert) => <div className="alert-item" key={alert.id}><BellRing size={18} aria-hidden="true" /><div><strong>{alert.studentName}</strong><span>{alert.date} · {alert.message}</span></div></div>)}{!alerts.length ? <div className="empty-state compact-empty"><strong>No Recent Alerts</strong><p>Assigned Students are currently on track.</p></div> : null}</div></DashboardPanel>
      <DashboardPanel title="Recent Activities" description="Today’s submissions and alerts"><ActivityList items={activityItems} emptyText="Assigned Student activity will appear here." /></DashboardPanel>
      <DashboardPanel title="Study & Growth" description="Quick access to assigned-group analysis" action={<Link href="/mentor/reports?range=30">Open Reports</Link>} className="dashboard-full-panel"><div className="dashboard-callout"><span><BookOpen size={24} aria-hidden="true" /></span><div><strong>Review the full 30-day report</strong><p>Compare study, sleep, chanting, attendance, and category scores.</p></div></div></DashboardPanel>
    </section>
    <DashboardPanel title="Hostel Scoreboard" description="Top 10 · Rolling 30 Days" className="section-gap"><GrowthLeaderboard students={globalReport.students.slice(0, 10)} /></DashboardPanel>
    <DashboardPanel title="My Students Quick Summary" description="Current rolling performance" className="section-gap"><StudentSummaryStrip students={globalReport.students} hrefBase="/mentor/students" /></DashboardPanel>
  </main>;
}
