import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, BookOpenCheck, CheckCircle2, ClipboardCheck, Clock3, HeartHandshake, MoonStar, Sparkles, Sunrise, XCircle } from "lucide-react";
import { CategoryLeaderboard } from "@/components/category-leaderboard";
import { ActivityList, AttendanceHeatmap, DashboardMetric, DashboardPanel, ScoreOverview, type ActivityItem } from "@/components/dashboard-ui";
import { WeeklyCategoryChart } from "@/components/growth-score-charts";
import { requireProfile } from "@/lib/auth";
import { formatMinutes, sleepDurationMinutes } from "@/lib/analytics";
import { daysAgoInIndia, displayDate, todayInIndia } from "@/lib/date";
import { getEntries, getLeaveRequests, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport, buildWeeklyCategorySeries } from "@/lib/growth-score";
import { studentGroupLabel } from "@/lib/student-groups";

export const metadata: Metadata = { title: "Student dashboard" };

export default async function StudentDashboard() {
  const profile = await requireProfile(["student"]);
  const today = todayInIndia();
  const start = daysAgoInIndia(6);
  const [entries, settings, source, leaves] = await Promise.all([
    getEntries({ startDate: start, studentId: profile.id }), getScoreSettings(), getStudentLeaderboardSource(start), getLeaveRequests({ studentId: profile.id }),
  ]);
  const report = buildGrowthReport(source.students, source.entries, settings, 7);
  const mine = report.students.find((student) => student.studentId === profile.id);
  const ownGroupCount = report.students.filter((student) => student.studentGroup === profile.student_group).length;
  const todayEntry = entries.find((entry) => entry.entry_date === today);
  const tasks = [
    ["Wake-up", todayEntry?.wake_time.slice(0, 5) ?? "Not filled", Sunrise],
    ["Meditation", todayEntry ? `${todayEntry.chanting_rounds ?? 0} rounds` : "Not filled", CheckCircle2],
    ["Morning Arati", todayEntry ? (todayEntry.morning_arati_attended ? "Attended" : "Not attended") : "Not filled", Sunrise],
    ["Gita class", todayEntry ? todayEntry.gita_class_status.replace("_", " ") : "Not filled", BookOpenCheck],
    ["Study", todayEntry ? formatMinutes(todayEntry.study_minutes) : "Not filled", Clock3],
    ["Sleep", todayEntry ? formatMinutes(sleepDurationMinutes(todayEntry.sleep_time, todayEntry.wake_time)) : "Not filled", MoonStar],
  ] as const;
  const score = mine ?? report.averages;
  const heatmapDays = (mine?.daily ?? []).map((day) => ({
    date: day.date,
    label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${day.date}T12:00:00+05:30`)),
    value: day.submitted ? 100 : 0,
    detail: day.submitted ? `${Math.round(day.overall)}/100 Score` : "Missing",
  }));
  const activityItems: ActivityItem[] = entries.slice(0, 5).map((entry) => ({
    id: entry.id,
    title: entry.entry_date === today ? "Today’s Entry Submitted" : "Daily Entry Submitted",
    description: `${formatMinutes(entry.study_minutes)} study · ${entry.chanting_rounds ?? 0} rounds`,
    meta: displayDate(entry.entry_date),
    icon: ClipboardCheck,
    tone: entry.entry_date === today ? "green" : "blue",
  }));

  return <main className="page-container">
    <header className="page-heading dashboard-heading">
      <div><p className="eyebrow">Student Dashboard</p><h1>Hare Krishna, {profile.full_name.split(" ")[0]}</h1><p>Your 7-day Growth Score and today’s Sadhana at a glance.</p></div>
      <Link className="button" href={`/student/entry?date=${today}`}>{todayEntry ? "Edit Today’s Entry" : "Fill Today’s Entry"}</Link>
    </header>
    <section className="dashboard-kpi-grid dashboard-kpi-five" aria-label="Your 7-day Growth Scores">
      <DashboardMetric label="Overall Growth" value={`${Math.round(score.overall)}/100`} detail={`Rank #${mine?.rank || "—"} of ${ownGroupCount} · ${studentGroupLabel(profile.student_group)}`} icon={Sparkles} tone="purple" />
      <DashboardMetric label="Sadhana" value={`${Math.round(score.sadhana)}/100`} detail="Morning Routine" icon={Sunrise} tone="green" />
      <DashboardMetric label="Study" value={`${Math.round(score.study)}/100`} detail="Study & Class" icon={BookOpen} tone="blue" />
      <DashboardMetric label="Discipline" value={`${Math.round(score.discipline)}/100`} detail="Sleep & Wake" icon={MoonStar} tone="orange" />
      <DashboardMetric label="Seva" value={`${Math.round(score.seva)}/100`} detail="Service Minutes" icon={HeartHandshake} tone="rose" />
    </section>
    <section className="dashboard-reference-grid section-gap">
      <DashboardPanel title="Today’s Sadhana" description="Your daily routine checklist" action={<span className={`status-pill ${todayEntry ? "status-success" : "status-warning"}`}>{todayEntry ? "Submitted" : "Pending"}</span>} className="student-sadhana-panel"><div className="sadhana-list">{tasks.map(([label, value, Icon]) => <div key={label} className="sadhana-row"><Icon size={19} aria-hidden="true" /><span>{label}</span><strong>{value}</strong>{todayEntry ? <CheckCircle2 size={17} className="success-icon" aria-label="Filled" /> : <XCircle size={17} className="danger-icon" aria-label="Missing" />}</div>)}</div><Link className="button button-secondary full-width" href={`/student/entry?date=${today}`}>{todayEntry ? "View or Edit Full Entry" : "Complete Today’s Entry"}</Link></DashboardPanel>
      <DashboardPanel title="Overall Progress" description="Rolling 7-day score" className="score-panel"><ScoreOverview scores={score} /></DashboardPanel>
      <DashboardPanel title="Submission Calendar" description={`${mine?.submittedDays ?? 0}/${mine?.eligibleDays ?? 0} entries submitted`}><AttendanceHeatmap days={heatmapDays} /><p className="field-hint dashboard-hint">You can update today and yesterday. Older missing dates remain visible but locked.</p></DashboardPanel>
      <DashboardPanel title="Weekly Progress" description="Last 7 eligible days by category" action={<Link href="/student/progress">Full Progress</Link>} className="dashboard-wide-panel"><WeeklyCategoryChart data={buildWeeklyCategorySeries(report, profile.id)} /></DashboardPanel>
      <DashboardPanel title="Recent Activities" description="Your latest Daily Entries"><ActivityList items={activityItems} emptyText="Your submitted Daily Entries will appear here." /></DashboardPanel>
      <DashboardPanel title="My Home Leave" description="Applications and approvals" action={<Link href="/student/leave">Open Leave Portal</Link>} className="dashboard-full-panel"><div className="student-mini-stats"><span><b>{leaves.requests.filter((request) => request.status === "pending").length}</b>Pending</span><span><b>{leaves.requests.filter((request) => request.status === "approved").length}</b>Approved</span><span><b>{leaves.requests.filter((request) => request.status === "rejected").length}</b>Rejected</span></div>{!leaves.available ? <p className="field-hint">Available after the leave migration.</p> : null}</DashboardPanel>
    </section>
    <DashboardPanel title="Hostel Scoreboards" description="Top 10 Students per group · Rolling 7 Days" className="section-gap" action={<span>Your Rank: #{mine?.rank || "—"} of {ownGroupCount}</span>}><CategoryLeaderboard students={report.students} currentStudentId={profile.id} /></DashboardPanel>
    <p className="security-note section-gap">Scores cover {displayDate(start)} through {displayDate(today)} and automatically roll forward each day.</p>
  </main>;
}
