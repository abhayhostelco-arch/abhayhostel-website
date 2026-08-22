import type { Metadata } from "next";
import { Download } from "lucide-react";
import { TrendChart } from "@/components/trend-chart";
import { average, averageClock, formatClock, formatMinutes, sleepDurationMinutes, total, totalRecorded } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia } from "@/lib/date";
import { getEntries, getProfiles } from "@/lib/data";
import { reportQuerySchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; studentId?: string }> }) {
  await requireProfile(["super_admin", "admin"]);
  const raw = await searchParams;
  const parsed = reportQuerySchema.safeParse(raw);
  const range = parsed.success ? Number(parsed.data.range) : 30;
  const studentId = parsed.success ? parsed.data.studentId : undefined;
  const [students, entries] = await Promise.all([
    getProfiles("student"), getEntries({ startDate: daysAgoInIndia(range - 1), studentId }),
  ]);
  const activeStudents = students.filter((student) => student.is_active);
  const scopedStudents = studentId ? activeStudents.filter((student) => student.id === studentId) : activeStudents;
  const possible = Math.max(scopedStudents.length * range, 1);
  const completion = Math.min(100, Math.round((entries.length / possible) * 100));
  const classes = entries.filter((entry) => entry.academy_status !== "no_class");
  const attendance = classes.length === 0 ? 0 : Math.round((classes.filter((entry) => entry.academy_status === "present").length / classes.length) * 100);
  const totalStudy = total(entries.map((entry) => entry.study_minutes));
  const totalRounds = totalRecorded(entries.map((entry) => entry.chanting_rounds));
  const chartData = [...entries].reverse().map((entry) => ({
    date: entry.entry_date.slice(5), sleepHours: Number((sleepDurationMinutes(entry.sleep_time, entry.wake_time) / 60).toFixed(1)), studyHours: Number((entry.study_minutes / 60).toFixed(1)),
  }));
  const exportQuery = new URLSearchParams({ range: String(range) });
  if (studentId) exportQuery.set("studentId", studentId);
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Analysis</p><h1>Routine reports</h1><p>Compare submission, sleep, study, chanting, and attendance trends.</p></div><a className="button" href={`/api/reports/export?${exportQuery}`}><Download size={18} /> Export CSV</a></header>
      <section className="panel">
        <form className="filters" method="get">
          <div className="field"><label htmlFor="range">Range</label><select id="range" name="range" defaultValue={String(range)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>
          <div className="field"><label htmlFor="studentId">Student</label><select id="studentId" name="studentId" defaultValue={studentId ?? ""}><option value="">All active students</option>{activeStudents.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></div>
          <button className="button button-secondary" type="submit">Update report</button>
        </form>
      </section>
      <section className="metric-grid section-gap-small">
        <article className="metric-card"><span>Completion</span><strong>{completion}%</strong></article>
        <article className="metric-card"><span>Attendance</span><strong>{attendance}%</strong></article>
        <article className="metric-card"><span>Average sleep</span><strong>{formatMinutes(average(entries.map((entry) => sleepDurationMinutes(entry.sleep_time, entry.wake_time))))}</strong></article>
        <article className="metric-card"><span>Average study</span><strong>{formatMinutes(average(entries.map((entry) => entry.study_minutes)))}</strong></article>
        <article className="metric-card"><span>Total study</span><strong>{formatMinutes(totalStudy)}</strong></article>
        <article className="metric-card"><span>Total chanting</span><strong>{totalRounds === null ? "—" : `${totalRounds} rounds`}</strong></article>
      </section>
      <section className="content-grid">
        <article className="panel"><div className="panel-title"><h2>Routine trend</h2></div><TrendChart data={chartData} /></article>
        <article className="panel"><div className="panel-title"><h2>Clock averages</h2></div><div className="metric-grid metric-grid-single"><div className="metric-card"><span>Average sleep time</span><strong>{formatClock(averageClock(entries.map((entry) => entry.sleep_time), true))}</strong></div><div className="metric-card"><span>Average wake time</span><strong>{formatClock(averageClock(entries.map((entry) => entry.wake_time)))}</strong></div></div></article>
      </section>
    </main>
  );
}
