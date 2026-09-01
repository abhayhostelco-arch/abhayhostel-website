import type { Metadata } from "next";
import { BookOpen, CalendarCheck2, CheckCircle2, Clock3, Download, Sparkles } from "lucide-react";
import { DashboardMetric } from "@/components/dashboard-ui";
import { CategoryGrowthChart, OverallGrowthChart } from "@/components/growth-score-charts";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { GrowthScoreCards } from "@/components/growth-score-cards";
import { TrendChart } from "@/components/trend-chart";
import { average, averageClock, formatClock, formatMinutes, sleepDurationMinutes, total, totalRecorded } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia } from "@/lib/date";
import { getEntries, getProfiles, getScoreSettings } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";
import { reportQuerySchema } from "@/lib/validation";
import { filterStudentsByGroup, studentGroupOptions } from "@/lib/student-groups";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; studentId?: string; group?: string }> }) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const raw = await searchParams;
  const parsed = reportQuerySchema.safeParse(raw);
  const range = parsed.success ? Number(parsed.data.range) : 30;
  const requestedStudentId = parsed.success ? parsed.data.studentId : undefined;
  const group = parsed.success ? parsed.data.group : undefined;
  const [activeStudents, scoreSettings] = await Promise.all([getProfiles("student", true), getScoreSettings()]);
  const groupStudents = filterStudentsByGroup(activeStudents, group);
  const studentId = groupStudents.some((student) => student.id === requestedStudentId) ? requestedStudentId : undefined;
  const scopedStudents = studentId ? groupStudents.filter((student) => student.id === studentId) : groupStudents;
  const start = daysAgoInIndia(range - 1);
  const allEntries = await getEntries({ startDate: start, studentIds: groupStudents.map((student) => student.id), completeScoringWeeks: true });
  const entries = allEntries.filter((entry) => entry.entry_date >= start && (!studentId || entry.student_id === studentId));
  const possible = Math.max(scopedStudents.length * range, 1);
  const completion = Math.min(100, Math.round((entries.length / possible) * 100));
  const classes = entries.filter((entry) => entry.gita_class_status !== "no_class");
  const attendance = classes.length === 0 ? 0 : Math.round((classes.filter((entry) => entry.gita_class_status === "present").length / classes.length) * 100);
  const totalStudy = total(entries.map((entry) => entry.study_minutes));
  const totalRounds = totalRecorded(entries.map((entry) => entry.chanting_rounds));
  const chartData = [...entries].reverse().map((entry) => ({
    date: entry.entry_date.slice(5), sleepHours: Number((sleepDurationMinutes(entry.sleep_time, entry.wake_time) / 60).toFixed(1)), studyHours: Number((entry.study_minutes / 60).toFixed(1)),
  }));
  const growthReport = buildGrowthReport(groupStudents, allEntries, scoreSettings, range);
  const selectedGrowth = studentId ? growthReport.students.find((student) => student.studentId === studentId) ?? growthReport.averages : growthReport.averages;
  const selectedDaily = studentId ? growthReport.students.find((student) => student.studentId === studentId)?.daily ?? [] : growthReport.dates.map((date) => {
    const values = growthReport.students.map((student) => student.daily.find((day) => day.date === date)).filter((day) => day !== undefined);
    const divisor = Math.max(values.length, 1);
    return values.reduce((sum, day) => ({ date, submitted: true, sadhana: sum.sadhana + day.sadhana / divisor, study: sum.study + day.study / divisor, discipline: sum.discipline + day.discipline / divisor, seva: sum.seva + day.seva / divisor, overall: sum.overall + day.overall / divisor }), { date, submitted: true, sadhana: 0, study: 0, discipline: 0, seva: 0, overall: 0 });
  });
  const growthChartData = selectedDaily.map((day) => ({ ...day, date: day.date.slice(5) }));
  const exportQuery = new URLSearchParams({ range: String(range) });
  if (studentId) exportQuery.set("studentId", studentId);
  if (group) exportQuery.set("group", group);
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Insights / Analysis</p><h1>Student Routine Reports</h1><p>Review the last 30 days by default, select {actor.role === "super_admin" ? "any active student" : "an assigned active student"}, and compare submission, sleep, study, chanting, and attendance trends.</p></div><a className="button" href={`/api/reports/export?${exportQuery}`}><Download size={18} aria-hidden="true" /> Export CSV</a></header>
      <section className="panel">
        <form className="filters" method="get">
          <div className="field"><label htmlFor="range">Range</label><select id="range" name="range" defaultValue={String(range)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>
          <div className="field"><label htmlFor="group">Group</label><select id="group" name="group" defaultValue={group ?? ""}><option value="">All Groups</option>{studentGroupOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="field"><label htmlFor="studentId">Student</label><select id="studentId" name="studentId" defaultValue={studentId ?? ""}><option value="">{actor.role === "super_admin" ? "All active students" : "All assigned students"}</option>{groupStudents.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></div>
          <button className="button button-secondary" type="submit">Update Report</button>
        </form>
      </section>
      <section className="dashboard-kpi-grid section-gap-small" aria-label="Report summary">
        <DashboardMetric label="Completion" value={`${completion}%`} detail={`${range}-Day Range`} icon={CheckCircle2} tone="green" />
        <DashboardMetric label="Gita Attendance" value={`${attendance}%`} detail="Reported Classes" icon={CalendarCheck2} tone="blue" />
        <DashboardMetric label="Average Sleep" value={formatMinutes(average(entries.map((entry) => sleepDurationMinutes(entry.sleep_time, entry.wake_time))))} detail="Per Entry" icon={Clock3} tone="purple" />
        <DashboardMetric label="Average Study" value={formatMinutes(average(entries.map((entry) => entry.study_minutes)))} detail="Per Entry" icon={BookOpen} tone="orange" />
        <DashboardMetric label="Total Study" value={formatMinutes(totalStudy)} detail="Selected Range" icon={Sparkles} tone="rose" />
        <DashboardMetric label="Total Chanting" value={totalRounds === null ? "—" : `${totalRounds}`} detail={totalRounds === null ? "No Data" : "Rounds"} icon={Sparkles} tone="gold" />
      </section>
      <section className="panel section-gap"><div className="panel-title"><h2>Growth Score</h2><span>Missing entries score zero</span></div><GrowthScoreCards scores={selectedGrowth} /></section>
      <section className="content-grid"><article className="panel"><div className="panel-title"><h2>Overall score trend</h2></div><OverallGrowthChart data={growthChartData} /></article><article className="panel"><div className="panel-title"><h2>Category comparison</h2></div><CategoryGrowthChart scores={selectedGrowth} /></article></section>
      <section className="panel section-gap"><div className="panel-title"><h2>{range}-day leaderboard</h2></div><GrowthLeaderboard students={growthReport.students} /></section>
      <p className="security-note section-gap">“Seva &amp; Character” is calculated from self-reported seva minutes; it is not a subjective character assessment.</p>
      <section className="content-grid">
        <article className="panel"><div className="panel-title"><h2>Routine trend</h2></div><TrendChart data={chartData} /></article>
        <article className="panel"><div className="panel-title"><h2>Clock averages</h2></div><div className="metric-grid metric-grid-single"><div className="metric-card"><span>Average sleep time</span><strong>{formatClock(averageClock(entries.map((entry) => entry.sleep_time), true))}</strong></div><div className="metric-card"><span>Average wake time</span><strong>{formatClock(averageClock(entries.map((entry) => entry.wake_time)))}</strong></div></div></article>
      </section>
    </main>
  );
}
