import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TrendChart } from "@/components/trend-chart";
import { CategoryGrowthChart, OverallGrowthChart } from "@/components/growth-score-charts";
import { GrowthScoreCards } from "@/components/growth-score-cards";
import { DailyEntryForm } from "@/components/daily-entry-form";
import { average, formatMinutes, sleepDurationMinutes, total, totalRecorded } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate, isWithinEntryWindow, todayInIndia } from "@/lib/date";
import { getEntries, getProfiles, getScoreSettings } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";

export const metadata: Metadata = { title: "Student trends" };

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string; date?: string }> }) {
  await requireProfile(["super_admin", "admin"]);
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const range = query.range === "7" || query.range === "30" ? Number(query.range) : 90;
  const correctionDate = query.date && isWithinEntryWindow(query.date) ? query.date : todayInIndia();
  const [students, scoreSettings] = await Promise.all([getProfiles("student"), getScoreSettings()]);
  const student = students.find((profile) => profile.id === id);
  if (!student) notFound();
  const activeStudents = students.filter((profile) => profile.is_active);
  const activeEntries = await getEntries({ startDate: daysAgoInIndia(range - 1), studentIds: activeStudents.map((profile) => profile.id) });
  const entries = student.is_active ? activeEntries.filter((entry) => entry.student_id === id) : await getEntries({ startDate: daysAgoInIndia(range - 1), studentId: id });
  const totalStudy = total(entries.map((entry) => entry.study_minutes));
  const totalRounds = totalRecorded(entries.map((entry) => entry.chanting_rounds));
  const chartData = [...entries].reverse().map((entry) => ({ date: entry.entry_date.slice(5), sleepHours: Number((sleepDurationMinutes(entry.sleep_time, entry.wake_time) / 60).toFixed(1)), studyHours: Number((entry.study_minutes / 60).toFixed(1)) }));
  const personalGrowth = buildGrowthReport([{ ...student, is_active: true }], entries, scoreSettings, range).students[0];
  const activeGrowth = buildGrowthReport(activeStudents, activeEntries, scoreSettings, range).students.find((report) => report.studentId === id);
  const growthChartData = (personalGrowth?.daily ?? []).map((day) => ({ ...day, date: day.date.slice(5) }));
  const correctionEntry = entries.find((entry) => entry.entry_date === correctionDate);
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Student trends</p><h1>{student.full_name}</h1><p>{student.email} · {student.academy_label ?? "No academy label"}</p></div></header>
      <section className="panel">
        <form className="filters" method="get"><div className="field"><label htmlFor="range">Range</label><select id="range" name="range" defaultValue={String(range)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div><button className="button button-secondary" type="submit">Update summary</button></form>
      </section>
      <section className="metric-grid section-gap-small"><article className="metric-card"><span>{range}-day entries</span><strong>{entries.length}</strong></article><article className="metric-card"><span>Average sleep</span><strong>{formatMinutes(average(entries.map((entry) => sleepDurationMinutes(entry.sleep_time, entry.wake_time))))}</strong></article><article className="metric-card"><span>Total study</span><strong>{formatMinutes(totalStudy)}</strong></article><article className="metric-card"><span>Total chanting</span><strong>{totalRounds === null ? "—" : `${totalRounds} rounds`}</strong></article><article className="metric-card"><span>Status</span><strong>{student.is_active ? "Active" : "Inactive"}</strong></article></section>
      {personalGrowth ? <section className="panel section-gap"><div className="panel-title"><h2>Growth Score</h2><span>{activeGrowth ? `Rank #${activeGrowth.rank}` : "Historical report"}</span></div><GrowthScoreCards scores={personalGrowth} /></section> : null}
      {personalGrowth ? <section className="content-grid"><article className="panel"><div className="panel-title"><h2>Overall score trend</h2></div><OverallGrowthChart data={growthChartData} /></article><article className="panel"><div className="panel-title"><h2>Category comparison</h2></div><CategoryGrowthChart scores={personalGrowth} /></article></section> : null}
      <section className="panel section-gap"><div className="panel-title"><div><h2>Mentor correction</h2><span>Authorized staff may correct the last 90 days.</span></div></div><form className="filters" method="get"><input type="hidden" name="range" value={range} /><div className="field"><label htmlFor="date">Entry date</label><input id="date" name="date" type="date" min={daysAgoInIndia(89)} max={todayInIndia()} defaultValue={correctionDate} /></div><button className="button button-secondary">Load entry</button></form><DailyEntryForm key={correctionDate} studentId={student.id} selectedDate={correctionDate} entry={correctionEntry} minDate={daysAgoInIndia(89)} maxDate={todayInIndia()} /></section>
      <section className="panel section-gap"><div className="panel-title"><h2>{range}-day trend</h2></div><TrendChart data={chartData} /></section>
      <section className="panel section-gap"><div className="panel-title"><h2>Daily records</h2></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Bedtime</th><th>Wake-up</th><th>Sleep</th><th>Study</th><th>Rounds</th><th>Arati</th><th>Gita class</th><th>Reading</th><th>Library</th><th>Seva</th><th>Note</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{displayDate(entry.entry_date)}</td><td>{entry.sleep_time.slice(0, 5)}</td><td>{entry.wake_time.slice(0, 5)}</td><td>{formatMinutes(sleepDurationMinutes(entry.sleep_time, entry.wake_time))}</td><td>{formatMinutes(entry.study_minutes)}</td><td>{entry.chanting_rounds ?? "—"}</td><td>{entry.morning_arati_attended ? "Yes" : "No"}</td><td>{entry.gita_class_status.replace("_", " ")}</td><td>{entry.evening_reading_minutes}m</td><td>{entry.library_attended ? "Yes" : "No"}</td><td>{entry.seva_minutes}m</td><td>{entry.note ?? "—"}</td></tr>)}</tbody></table>{entries.length === 0 ? <p className="empty-state">No entries in this range.</p> : null}</div></section>
      <p className="security-note section-gap">“Seva &amp; Character” is calculated from self-reported seva minutes; it is not a subjective character assessment.</p>
    </main>
  );
}
