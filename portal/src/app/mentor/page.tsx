import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, ClipboardCheck, Sparkles, Users } from "lucide-react";
import { ActivityList, AttendanceHeatmap, DashboardMetric, DashboardPanel, ScoreOverview, StudentSummaryStrip, type ActivityItem } from "@/components/dashboard-ui";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { TrendChart } from "@/components/trend-chart";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";
import { getEntries, getProfiles, getScoreSettings } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";

export default async function MentorDashboard() {
  const mentor = await requireProfile(["admin"]);
  const start = daysAgoInIndia(29); const today = todayInIndia();
  const active = await getProfiles("student", true);
  const [entries, settings] = await Promise.all([getEntries({ startDate: start, studentIds: active.map((student) => student.id), completeScoringWeeks: true }), getScoreSettings()]);
  const todayEntries = entries.filter((entry) => entry.entry_date === today);
  const assignedReport = buildGrowthReport(active, entries, settings, 30);
  const chartData = Array.from({ length: 30 }, (_, index) => { const date = daysAgoInIndia(29 - index); const count = entries.filter((entry) => entry.entry_date === date).length; return { date: date.slice(5), completion: active.length ? Math.round(count / active.length * 100) : 0 }; });
  const heatmapDays = chartData.slice(-7).map((day, index) => ({
    date: daysAgoInIndia(6 - index),
    label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${daysAgoInIndia(6 - index)}T12:00:00+05:30`)),
    value: active.length ? day.completion ?? 0 : null,
    detail: active.length ? `${entries.filter((entry) => entry.entry_date === daysAgoInIndia(6 - index)).length}/${active.length} Submitted` : "No Students",
  }));
  const activityItems: ActivityItem[] = [
    ...todayEntries.slice(0, 3).map((entry) => ({ id: `entry-${entry.id}`, title: "Daily Entry Submitted", description: active.find((student) => student.id === entry.student_id)?.full_name ?? "Student", meta: "Today", icon: ClipboardCheck, tone: "blue" as const })),
  ].slice(0, 5);
  return <main className="page-container">
    <header className="page-heading dashboard-heading"><div><p className="eyebrow">Mentor Workspace</p><h1>Hare Krishna, {mentor.full_name.split(" ")[0]} 🙏</h1><p>Review assigned Students and respond to missed entries early.</p></div><div className="heading-actions"><Link className="button button-secondary" href="/mentor/reports?range=30">30-Day Reports</Link><Link className="button" href="/mentor/students">View My Students</Link></div></header>
    <section className="dashboard-kpi-grid dashboard-kpi-four" aria-label="Assigned-group summary">
      <DashboardMetric label="Assigned Students" value={active.length} detail="Active Students" icon={Users} tone="purple" />
      <DashboardMetric label="Submitted Today" value={todayEntries.length} detail="Daily Entries" icon={CheckCircle2} tone="green" />
      <DashboardMetric label="Missing Today" value={Math.max(active.length - todayEntries.length, 0)} detail="Need a Reminder" icon={Clock3} tone="orange" />
      <DashboardMetric label="Group Growth" value={`${Math.round(assignedReport.averages.overall)}/100`} detail="Rolling 30 Days" icon={Sparkles} tone="blue" />
    </section>
    <section className="dashboard-reference-grid section-gap">
      <DashboardPanel title="Assigned-Group Completion" description="Daily submission percentage · Last 30 days" className="dashboard-wide-panel"><TrendChart data={chartData} mode="completion" /></DashboardPanel>
      <DashboardPanel title="Weekly Completion" description="Recent Daily Entry consistency"><AttendanceHeatmap days={heatmapDays} /></DashboardPanel>
      <DashboardPanel title="Group Progress" description="Rolling 30-day category average" className="score-panel"><ScoreOverview scores={assignedReport.averages} /></DashboardPanel>
      <DashboardPanel title="Recent Activities" description="Today’s submitted Daily Entries"><ActivityList items={activityItems} emptyText="Assigned Student activity will appear here." /></DashboardPanel>
      <DashboardPanel title="Study & Growth" description="Quick access to assigned-group analysis" action={<Link href="/mentor/reports?range=30">Open Reports</Link>} className="dashboard-full-panel"><div className="dashboard-callout"><span><BookOpen size={24} aria-hidden="true" /></span><div><strong>Review the full 30-day report</strong><p>Compare study, sleep, chanting, attendance, and category scores.</p></div></div></DashboardPanel>
    </section>
    <DashboardPanel title="Hostel Scoreboards" description="Top 10 per group · Rolling 30 Days" className="section-gap"><GrowthLeaderboard students={assignedReport.students} /></DashboardPanel>
    <DashboardPanel title="My Students Quick Summary" description="Current rolling performance by group" className="section-gap"><StudentSummaryStrip students={assignedReport.students} hrefBase="/mentor/students" /></DashboardPanel>
  </main>;
}
