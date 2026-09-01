import type { Metadata } from "next";
import { CategoryGrowthChart, OverallGrowthChart } from "@/components/growth-score-charts";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { GrowthScoreCards } from "@/components/growth-score-cards";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate } from "@/lib/date";
import { getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport, roundedScores } from "@/lib/growth-score";
import { studentGroupLabel } from "@/lib/student-groups";

export const metadata: Metadata = { title: "Growth progress" };

export default async function StudentProgressPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const profile = await requireProfile(["student"]);
  const params = await searchParams;
  const range = params.range === "7" || params.range === "90" ? Number(params.range) : 30;
  const [settings, source] = await Promise.all([getScoreSettings(), getStudentLeaderboardSource(daysAgoInIndia(range - 1))]);
  const report = buildGrowthReport(source.students, source.entries, settings, range);
  const mine = report.students.find((student) => student.studentId === profile.id);
  const ownGroupCount = report.students.filter((student) => student.studentGroup === profile.student_group).length;
  const scores = mine ?? { studentId: profile.id, studentName: profile.full_name, studentGroup: profile.student_group ?? null, eligibleDays: 0, submittedDays: 0, rank: 0, daily: [], sadhana: 0, study: 0, discipline: 0, seva: 0, overall: 0 };
  const chartData = scores.daily.map((day) => ({ ...day, date: day.date.slice(5) }));
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Personal growth</p><h1>Progress report</h1><p>Your score reflects submitted routines from {displayDate(settings.score_start_date)} onward. Missing entries score zero.</p></div><span className="status-pill status-success">Rank #{scores.rank || "—"} of {ownGroupCount} · {studentGroupLabel(profile.student_group)}</span></header>
      <section className="panel"><form className="filters" method="get"><div className="field"><label htmlFor="range">Range</label><select id="range" name="range" defaultValue={String(range)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div><button className="button button-secondary" type="submit">Update report</button></form></section>
      <section className="section-gap-small"><GrowthScoreCards scores={scores} /></section>
      <section className="content-grid">
        <article className="panel"><div className="panel-title"><h2>Overall score trend</h2></div><OverallGrowthChart data={chartData} /></article>
        <article className="panel"><div className="panel-title"><h2>Category comparison</h2></div><CategoryGrowthChart scores={scores} /></article>
      </section>
      <section className="panel section-gap"><div className="panel-title"><h2>{range}-day leaderboard</h2><span>{scores.submittedDays}/{scores.eligibleDays} entries submitted</span></div><GrowthLeaderboard students={report.students} currentStudentId={profile.id} /></section>
      <section className="panel section-gap"><div className="panel-title"><h2>Daily score history</h2></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Overall</th><th>Sadhana</th><th>Study</th><th>Discipline</th><th>Seva</th><th>Status</th></tr></thead><tbody>{scores.daily.slice().reverse().map((day) => { const value = roundedScores(day); return <tr key={day.date}><td>{displayDate(day.date)}</td><td>{value.overall}</td><td>{value.sadhana}</td><td>{value.study}</td><td>{value.discipline}</td><td>{value.seva}</td><td>{day.submitted ? "Submitted" : "Missing"}</td></tr>; })}</tbody></table></div></section>
      <p className="security-note section-gap">“Seva &amp; Character” is calculated from self-reported seva minutes; it is not a subjective character assessment.</p>
    </main>
  );
}
