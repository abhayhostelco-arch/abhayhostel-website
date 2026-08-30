import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck2, CheckCircle2, ClipboardCheck, ShieldCheck, Sparkles, UserRoundX, Users } from "lucide-react";
import { AdminDashboardFilters } from "@/components/admin-dashboard-filters";
import { AutoCleanupTrigger } from "@/components/auto-cleanup-trigger";
import { ActivityList, AttendanceHeatmap, DashboardMetric, DashboardPanel, ScoreOverview, StudentSummaryStrip, type ActivityItem } from "@/components/dashboard-ui";
import { StudentPerformanceTable } from "@/components/student-performance-table";
import { ProfileAvatar } from "@/components/profile-avatar";
import { TrendChart } from "@/components/trend-chart";
import { average, formatMinutes } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { approvedLeaveDaysInMonth, daysAgoInIndia, displayDate, todayInIndia } from "@/lib/date";
import { getAvatarSignedUrl, getEntries, getGitaAttendance, getLeaveRequests, getProfiles, getScoreSettings, getStudentLeaderboardSource } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";
import { summarizeAttendanceDays } from "@/lib/gita-attendance";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ mentorId?: string; range?: string; startDate?: string; endDate?: string }> }) {
  await requireProfile(["super_admin"]);
  const { mentorId, range: requestedRange, startDate: requestedStartDate, endDate: requestedEndDate } = await searchParams;
  const rangeSelection = requestedRange === "7" || requestedRange === "90" || requestedRange === "custom" ? requestedRange : "30";
  const today = todayInIndia();
  const validDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  const requestedCustomEnd = rangeSelection === "custom" && validDate(requestedEndDate) && requestedEndDate! <= today ? requestedEndDate! : today;
  const customEndNow = new Date(`${requestedCustomEnd}T12:00:00+05:30`);
  const earliestCustomDate = daysAgoInIndia(89, customEndNow);
  const customStartDate = rangeSelection === "custom" && validDate(requestedStartDate) && requestedStartDate! >= earliestCustomDate && requestedStartDate! <= requestedCustomEnd ? requestedStartDate! : daysAgoInIndia(29, customEndNow);
  const range = rangeSelection === "custom" ? Math.round((customEndNow.getTime() - new Date(`${customStartDate}T12:00:00+05:30`).getTime()) / 86_400_000) + 1 : Number(rangeSelection);
  const endDate = rangeSelection === "custom" ? requestedCustomEnd : today;
  const selectedNow = new Date(`${endDate}T12:00:00+05:30`);
  const start = rangeSelection === "custom" ? customStartDate : daysAgoInIndia(range - 1, selectedNow);
  const rangeLabel = rangeSelection === "custom" ? `${displayDate(start)} – ${displayDate(endDate)}` : `Last ${range} Days`;
  const reportRange = range <= 7 ? 7 : range <= 30 ? 30 : 90;
  const [active, mentors, scoreSettings, source] = await Promise.all([
    getProfiles("student", true), getProfiles("admin", true), getScoreSettings(), getStudentLeaderboardSource(start),
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
  ].slice(0, 5);
  const highlightedStudent = scopedReport[0];
  const leaveResult = await getLeaveRequests({ month: endDate.slice(0, 7) });
  const homeDays = new Map(scopedStudents.map((student) => [student.id, approvedLeaveDaysInMonth(leaveResult.requests.filter((request) => request.student_id === student.id), endDate.slice(0, 7))]));
  const studentsAway = new Set(leaveResult.requests.filter((request) => request.status === "approved" && request.start_date <= endDate && request.end_date >= endDate).map((request) => request.student_id)).size;
  return <main className="page-container"><AutoCleanupTrigger />
    <header className="page-heading dashboard-heading"><div><p className="eyebrow">Overview · {rangeLabel}</p><h1>Hare Krishna 🙏</h1><p>Monitor attendance, student routines, and overall growth for the selected period.</p></div><div className="heading-actions"><AdminDashboardFilters initialRange={rangeSelection} initialStartDate={start} initialEndDate={endDate} earliestDate={daysAgoInIndia(89)} today={today} initialMentorId={allowedMentor} mentors={mentors.map((mentor) => ({ id: mentor.id, fullName: mentor.full_name }))} /></div></header>
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
        {highlightedStudent ? <Link className="student-overview-link" href={`/admin/students/${highlightedStudent.studentId}`} aria-label={`View ${highlightedStudent.studentName}'s profile`}><div className="featured-student"><div className="featured-student-avatar"><Sparkles size={22} aria-hidden="true" /></div><div><span className="status-pill status-success">Active</span><h3>{highlightedStudent.studentName}</h3><p>Rank #{highlightedStudent.rank} · {highlightedStudent.submittedDays}/{highlightedStudent.eligibleDays} Entries</p></div><strong>{Math.round(highlightedStudent.overall)}<small>/100</small></strong></div><div className="student-mini-stats"><span><b>{Math.round(highlightedStudent.sadhana)}</b>Sadhana</span><span><b>{Math.round(highlightedStudent.study)}</b>Study</span><span><b>{Math.round(highlightedStudent.discipline)}</b>Discipline</span><span><b>{Math.round(highlightedStudent.seva)}</b>Seva</span></div></Link> : <div className="empty-state compact-empty"><strong>No Students Yet</strong><p>Add an active Student to begin tracking growth.</p></div>}
      </DashboardPanel>
      <DashboardPanel title="Overall Progress" description={`Rolling ${range}-day group average`} className="score-panel"><ScoreOverview scores={report.averages} /></DashboardPanel>
      <DashboardPanel title="Gita Attendance" description="Recent official attendance"><AttendanceHeatmap days={heatmapDays} /></DashboardPanel>
      <DashboardPanel title="Students Present" description={`${range}-day range ending ${displayDate(endDate)}; unrecorded dates remain gaps`} action={<Link href={`/admin/gita-attendance?date=${endDate}`}>Record Attendance</Link>} className="dashboard-wide-panel">{attendance.available ? <TrendChart data={chartData} mode="attendance" /> : <div className="empty-state unavailable-state"><strong>Attendance Analytics Unavailable</strong><p>Apply the supplied migration to enable the official register.</p></div>}</DashboardPanel>
      <DashboardPanel title="Recent Activities" description="Today’s submitted Daily Entries"><ActivityList items={activityItems} /></DashboardPanel>
      <DashboardPanel title="Mentor Workload" description="Select a Mentor to view assigned Students" action={<Link href="/admin/administrators">Manage Mentors</Link>} className="dashboard-full-panel workload-panel"><div className="workload-list">{mentors.map((mentor) => { const count = active.filter((student) => student.mentor_id === mentor.id).length; return <Link href={`/admin/students?mentorId=${mentor.id}`} key={mentor.id}><ProfileAvatar name={mentor.full_name} src={mentorAvatars.get(mentor.id)} size={38} /><div className="workload-mentor-copy"><span className="workload-mentor-name" title={mentor.full_name}>{mentor.full_name}</span><strong>{count} {count === 1 ? "Student" : "Students"}</strong></div><ArrowRight size={18} aria-hidden="true" /></Link>; })}{!mentors.length ? <div className="empty-state compact-empty"><strong>No Mentors Yet</strong><p>Create a Mentor before assigning Students.</p></div> : null}</div></DashboardPanel>
      <DashboardPanel title="Home Leave" description={`Approved leave · ${endDate.slice(0, 7)}`} action={<Link href={`/admin/leaves?month=${endDate.slice(0, 7)}`}>Manage Leave</Link>} className="dashboard-full-panel"><div className="student-mini-stats"><span><b>{leaveResult.requests.filter((request) => request.status === "pending").length}</b>Pending</span><span><b>{studentsAway}</b>Away on Date</span><span><b>{approvedLeaveDaysInMonth(leaveResult.requests, endDate.slice(0, 7))}</b>Home Days</span></div>{!leaveResult.available ? <p className="field-hint">Available after the leave migration.</p> : null}</DashboardPanel>
    </section>
    <DashboardPanel title="Hostel Scoreboard" description={`Top 10 · ${rangeLabel}`} className="section-gap" action={<Link href={`/admin/daily-tracking?range=${reportRange}`}>Open Daily Tracking</Link>}><StudentPerformanceTable students={scopedReport} homeDays={homeDays} hrefBase="/admin/students" limit={10} /></DashboardPanel>
    <DashboardPanel title="Students Quick Summary" description={`Rolling ${range}-day performance`} className="section-gap student-summary-panel"><StudentSummaryStrip students={scopedReport} hrefBase="/admin/students" /></DashboardPanel>
  </main>;
}
