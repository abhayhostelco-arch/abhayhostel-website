import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Clock3, MoonStar, Sunrise, XCircle } from "lucide-react";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { GrowthScoreCards } from "@/components/growth-score-cards";
import { requireProfile } from "@/lib/auth";
import { formatMinutes, sleepDurationMinutes } from "@/lib/analytics";
import { daysAgoInIndia, displayDate, todayInIndia } from "@/lib/date";
import { getEntries, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";

export const metadata: Metadata = { title: "Student dashboard" };

export default async function StudentDashboard() {
  const profile = await requireProfile(["student"]);
  const today = todayInIndia();
  const start = daysAgoInIndia(6);
  const [entries, settings, source] = await Promise.all([
    getEntries({ startDate: start, studentId: profile.id }), getScoreSettings(), getStudentLeaderboardSource(start),
  ]);
  const report = buildGrowthReport(source.students, source.entries, settings, 7);
  const mine = report.students.find((student) => student.studentId === profile.id);
  const todayEntry = entries.find((entry) => entry.entry_date === today);
  const topTen = report.students.slice(0, 10);
  const visibleRank = mine && !topTen.some((student) => student.studentId === profile.id) ? mine : null;
  const tasks = [
    ["Wake-up", todayEntry?.wake_time.slice(0, 5) ?? "Not filled", Sunrise],
    ["Meditation", todayEntry ? `${todayEntry.chanting_rounds ?? 0} rounds` : "Not filled", CheckCircle2],
    ["Morning Arati", todayEntry ? (todayEntry.morning_arati_attended ? "Attended" : "Not attended") : "Not filled", Sunrise],
    ["Gita class", todayEntry ? todayEntry.gita_class_status.replace("_", " ") : "Not filled", BookOpenCheck],
    ["Study", todayEntry ? formatMinutes(todayEntry.study_minutes) : "Not filled", Clock3],
    ["Sleep", todayEntry ? formatMinutes(sleepDurationMinutes(todayEntry.sleep_time, todayEntry.wake_time)) : "Not filled", MoonStar],
  ] as const;

  return <main className="page-container">
    <header className="page-heading hero-heading">
      <div><p className="eyebrow">Hare Krishna 🙏</p><h1>Welcome, {profile.full_name.split(" ")[0]}</h1><p>Your rolling seven-day Growth Score and daily Sadhana at a glance.</p></div>
      <Link className="button" href={`/student/entry?date=${today}`}>{todayEntry ? "Edit today’s entry" : "Fill today’s entry"}</Link>
    </header>
    <section aria-labelledby="weekly-score-title"><div className="panel-title"><h2 id="weekly-score-title">Last 7 days</h2><span>{mine?.submittedDays ?? 0}/{mine?.eligibleDays ?? 0} entries submitted</span></div><GrowthScoreCards scores={mine ?? report.averages} /></section>
    <section className="dashboard-grid section-gap">
      <article className="panel"><div className="panel-title"><h2>Today’s Sadhana</h2><span className={`status-pill ${todayEntry ? "status-success" : "status-warning"}`}>{todayEntry ? "Submitted" : "Pending"}</span></div><div className="sadhana-list">{tasks.map(([label, value, Icon]) => <div key={label} className="sadhana-row"><Icon size={19} aria-hidden="true" /><span>{label}</span><strong>{value}</strong>{todayEntry ? <CheckCircle2 size={17} className="success-icon" aria-label="Filled" /> : <XCircle size={17} className="danger-icon" aria-label="Missing" />}</div>)}</div><Link className="button button-secondary full-width" href={`/student/entry?date=${today}`}>{todayEntry ? "View or edit full entry" : "Complete today’s entry"}</Link></article>
      <article className="panel"><div className="panel-title"><h2>Submission calendar</h2><span>Missing days score zero</span></div><div className="week-strip">{(mine?.daily ?? []).map((day) => <div key={day.date} className={`day-tile ${day.submitted ? "day-submitted" : "day-missing"}`}><span>{new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${day.date}T12:00:00+05:30`))}</span><strong>{Math.round(day.overall)}</strong><small>{day.submitted ? "Filled" : "Missing"}</small></div>)}</div><p className="field-hint">You can update today and yesterday. Older missing dates remain visible but locked.</p><Link href="/student/progress">View complete progress report →</Link></article>
    </section>
    <section className="panel section-gap"><div className="panel-title"><div><p className="eyebrow">Hostel scoreboard</p><h2>Top 10 students · rolling 7 days</h2></div><span>Your rank: #{mine?.rank || "—"}</span></div><GrowthLeaderboard students={topTen} currentStudentId={profile.id} />{visibleRank ? <div className="own-rank-card"><span>Your position</span><strong>#{visibleRank.rank} · {visibleRank.studentName}</strong><span>{Math.round(visibleRank.overall)}/100</span></div> : null}</section>
    <p className="security-note section-gap">Scores cover {displayDate(start)} through {displayDate(today)} and automatically roll forward each day.</p>
  </main>;
}
