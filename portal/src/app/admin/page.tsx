import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, BookOpen, CalendarCheck2, CheckCircle2, ClipboardCheck, ShieldCheck, Sparkles, UserRoundX, Users } from "lucide-react";
import { CategoryLeaderboard } from "@/components/category-leaderboard";
import { ActivityList, AttendanceHeatmap, DashboardMetric, DashboardPanel, ScoreOverview, StudentSummaryStrip, type ActivityItem } from "@/components/dashboard-ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { TrendChart } from "@/components/trend-chart";
import { average, deriveAlerts, formatMinutes } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate, todayInIndia } from "@/lib/date";
import { getAlertSettings, getAvatarSignedUrl, getEntries, getGitaAttendance, getProfiles, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";
import { summarizeAttendanceDays } from "@/lib/gita-attendance";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ mentorId?: string; range?: string; date?: string }> }) {
  await requireProfile(["super_admin"]);
  const { mentorId, range: requestedRange, date: requestedDate } = await searchParams;
  const range = requestedRange === "7" || requestedRange === "90" ? Number(requestedRange) : 30;
  const today = todayInIndia();
  const endDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
  const selectedNow = new Date(`${endDate}T12:00:00+05:30`);
  const start = daysAgoInIndia(range - 1, selectedNow);
  const [active, mentors, alertsSettings, scoreSettings, source] = await Promise.all([
    getProfiles("student", true), getProfiles("admin", true), getAlertSettings(), getScoreSettings(), getStudentLeaderboardSource(start),
  ]);
  const sourceEntries = source.entries.filter((entry) => entry.entry_date <= endDate);
  const report = buildGrowthReport(source.students, sourceEntries, scoreSettings, range, selectedNow);
  const mentorAvatars = new Map(await Promise.all(mentors.map(async (mentor) => [mentor.id, await getAvatarSignedUrl(mentor.avatar_path)] as const)));
  const allowedMentor = mentors.some((mentor) => mentor.id === mentorId) ? mentorId : undefined;
  const poolIds = new Set(active.filter((student) => !allowedMentor || student.mentor_id === allowedMentor).map((student) => student.id));
  const entries = (await getEntries({ startDate: start, studentIds: [...poolIds] })).filter((entry) => entry.entry_date <= endDate);
  const scopedReport = report.students.filter((student) => poolIds.has(student.studentId));
  const todayEntries = entries.filter((entry) => entry.entry_date === endDate && poolIds.has(entry.student_id));
  const scopedStudents = active.filter((student) => poolIds.has(student.id));
  const alerts = deriveAlerts(scopedStudents, entries, alertsSettings, range, selectedNow).slice(0, 6);
  const attendance = await getGitaAttendance(start, [...poolIds]);
  const dates = Array.from({ length: range }, (_, index) => daysAgoInIndia(range - 1 - index, selectedNow));
  const attendanceDays = summarizeAttendanceDays(dates, [...poolIds], attendance.records);
  const todayAttendance = attendanceDays.find((day) => day.date === endDate);
  const chartData = attendanceDays.map((day) => ({ date: day.date.slice(5), studentsPresent: attendance.available ? day.present : null }));
  const averageStudyToday = formatMinutes(average(todayEntries.map((entry) => entry.study_minutes)));
  const heatmapDays = attendanceDays.slice(-7).map((day) => ({
    date: day.date,
    label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${day.date}T12:00:00+05:30`)),
    value: attendance.available && day.recorded && day.present !== null ? Math.round(day.present / Math.max(day.expected, 1) * 100) : null,
    detail: attendance.available && day.recorded && day.present !== null ? `${day.present}/${day.expected} Present` : "Not Recorded",
  }));
  const activityItems: ActivityItem[] = [
    ...todayEntries.slice(0, 3).map((entry) => ({
      id: `entry-${entry.id}`,
      title: "Daily Entry Submitted",
      description: scopedStudents.find((student) => student.id === entry.student_id)?.full_name ?? "Student",
      meta: displayDate(endDate),
      icon: ClipboardCheck,
      tone: "blue" as const,
    })),
    ...alerts.slice(0, 3).map((alert) => ({ id: `alert-${alert.id}`, title: "Routine Alert", description: `${alert.studentName} · ${alert.message}`, meta: displayDate(alert.date), icon: BellRing, tone: "rose" as const })),
  ].slice(0, 5);
  const highlightedStudent = scopedReport[0];
  return <main className="page-container">
    <header className="page-heading dashboard-heading"><div><p className="eyebrow">Overview · {displayDate(endDate)}</p><h1>Hare Krishna 🙏</h1><p>Monitor attendance, student routines, and overall growth for the selected period.</p></div><div className="heading-actions"><form className="dashboard-header-filter" method="get"><label className="visually-hidden" htmlFor="dashboard-range">Report Range</label><select id="dashboard-range" name="range" defaultValue={String(range)}><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option></select><label className="visually-hidden" htmlFor="dashboard-date">End Date</label><input id="dashboard-date" name="date" type="date" max={today} defaultValue={endDate} /><label className="visually-hidden" htmlFor="mentorId">Filter by Mentor</label><select id="mentorId" name="mentorId" defaultValue={allowedMentor ?? ""}><option value="">All Students</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>)}</select><button className="button button-secondary button-small">Apply</button></form><Link className="button button-secondary" href={`/admin/reports?range=${range}`}>{range}-Day Reports</Link><Link className="button" href="/admin/students/new">Add Student</Link></div></header>
    <section className="dashboard-kpi-grid" aria-label="Today’s summary">
      <DashboardMetric label="Active Students" value={active.length} detail="Hostel Roster" icon={Users} tone="purple" />
      <DashboardMetric label="Active Mentors" value={mentors.filter((item) => item.is_active).length} detail="Guidance Team" icon={ShieldCheck} tone="green" />
      <DashboardMetric label="Submitted on Date" value={todayEntries.length} detail={`${Math.max(scopedStudents.length - todayEntries.length, 0)} Pending`} icon={CheckCircle2} tone="orange" />
      <DashboardMetric label="Present on Date" value={attendance.available ? (todayAttendance?.present ?? "—") : "—"} detail="Official Register" icon={CalendarCheck2} tone="blue" />
      <DashboardMetric label="Average Study" value={averageStudyToday} detail="Selected Date" icon={BookOpen} tone="rose" />
      <DashboardMetric label="Unassigned" value={active.filter((student) => !student.mentor_id).length} detail="Need a Mentor" icon={UserRoundX} tone="gold" />
    </section>
    <section className="dashboard-reference-grid section-gap">
      <DashboardPanel title="Student Overview" description={`Top rolling ${range}-day performance`} action={<Link href="/admin/students">View All</Link>} className="student-overview-panel">
        {highlightedStudent ? <div className="featured-student"><div className="featured-student-avatar"><Sparkles size={22} aria-hidden="true" /></div><div><span className="status-pill status-success">Active</span><h3>{highlightedStudent.studentName}</h3><p>Rank #{highlightedStudent.rank} · {highlightedStudent.submittedDays}/{highlightedStudent.eligibleDays} Entries</p></div><strong>{Math.round(highlightedStudent.overall)}<small>/100</small></strong></div> : <div className="empty-state compact-empty"><strong>No Students Yet</strong><p>Add an active Student to begin tracking growth.</p></div>}
        {highlightedStudent ? <div className="student-mini-stats"><span><b>{Math.round(highlightedStudent.sadhana)}</b>Sadhana</span><span><b>{Math.round(highlightedStudent.study)}</b>Study</span><span><b>{Math.round(highlightedStudent.discipline)}</b>Discipline</span><span><b>{Math.round(highlightedStudent.seva)}</b>Seva</span></div> : null}
      </DashboardPanel>
      <DashboardPanel title="Overall Progress" description={`Rolling ${range}-day group average`} className="score-panel"><ScoreOverview scores={report.averages} /></DashboardPanel>
      <DashboardPanel title="Gita Attendance" description="Recent official attendance"><AttendanceHeatmap days={heatmapDays} /></DashboardPanel>
      <DashboardPanel title="Students Present" description={`${range}-day range ending ${displayDate(endDate)}; unrecorded dates remain gaps`} action={<Link href={`/admin/gita-attendance?date=${endDate}`}>Record Attendance</Link>} className="dashboard-wide-panel">{attendance.available ? <TrendChart data={chartData} mode="attendance" /> : <div className="empty-state unavailable-state"><strong>Attendance Analytics Unavailable</strong><p>Apply the supplied migration to enable the official register.</p></div>}</DashboardPanel>
      <DashboardPanel title="Recent Activities" description="Today’s submissions and alerts" action={<Link href="/admin/alerts">View Alerts</Link>}><ActivityList items={activityItems} /></DashboardPanel>
      <DashboardPanel title="Mentor Workload" description="Select a Mentor to view assigned Students" action={<Link href="/admin/administrators">Manage Mentors</Link>} className="dashboard-full-panel workload-panel"><div className="workload-list">{mentors.map((mentor) => { const count = active.filter((student) => student.mentor_id === mentor.id).length; return <Link href={`/admin/students?mentorId=${mentor.id}`} key={mentor.id}><ProfileAvatar name={mentor.full_name} src={mentorAvatars.get(mentor.id)} size={38} /><span title={mentor.full_name}>{mentor.full_name}</span><strong>{count} {count === 1 ? "Student" : "Students"}</strong><ArrowRight size={18} aria-hidden="true" /></Link>; })}{!mentors.length ? <div className="empty-state compact-empty"><strong>No Mentors Yet</strong><p>Create a Mentor before assigning Students.</p></div> : null}</div></DashboardPanel>
    </section>
    <DashboardPanel title="Hostel Scoreboard" description={`Top 10 · Rolling ${range} Days`} className="section-gap" action={<Link href={`/admin/reports?range=${range}`}>Open Full Report</Link>}><CategoryLeaderboard students={scopedReport} /></DashboardPanel>
    <DashboardPanel title="Students Quick Summary" description={`Rolling ${range}-day performance`} className="section-gap"><StudentSummaryStrip students={scopedReport} hrefBase="/admin/students" /></DashboardPanel>
  </main>;
}
