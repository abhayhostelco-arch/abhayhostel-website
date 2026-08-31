import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CircleCheck, CircleX } from "lucide-react";
import { TrendChart } from "@/components/trend-chart";
import { CategoryGrowthChart, OverallGrowthChart } from "@/components/growth-score-charts";
import { GrowthScoreCards } from "@/components/growth-score-cards";
import { DailyEntryForm } from "@/components/daily-entry-form";
import { average, formatMinutes, sleepDurationMinutes, total, totalRecorded } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { approvedLeaveDaysInMonth, daysAgoInIndia, displayDate, isWithinEntryWindow, todayInIndia } from "@/lib/date";
import { getEntries, getLeaveRequests, getProfiles, getScoreSettings } from "@/lib/data";
import { buildGrowthReport } from "@/lib/growth-score";
import { ProfileAvatar } from "@/components/profile-avatar";
import { StudentBirthDateForm } from "@/components/student-birthdate-form";
import { StudentGroupForm } from "@/components/student-group-form";
import { LeaveDecisionControls } from "@/components/leave-decision-controls";
import { getAvatarSignedUrl, getPrivateUploadSignedUrl, getProfileEnhancements } from "@/lib/data";
import { studentGroupLabel } from "@/lib/student-groups";

export const metadata: Metadata = { title: "Student trends" };

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string; date?: string }> }) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const range = query.range === "7" || query.range === "30" ? Number(query.range) : 90;
  const correctionDate = query.date && isWithinEntryWindow(query.date) ? query.date : todayInIndia();
  const [students, scoreSettings] = await Promise.all([getProfiles("student"), getScoreSettings()]);
  const student = students.find((profile) => profile.id === id);
  if (!student) notFound();
  const [enhancements, leaveResult] = await Promise.all([getProfileEnhancements(student.id), getLeaveRequests({ studentId: student.id })]);
  const avatarUrl = enhancements.available ? await getAvatarSignedUrl(enhancements.avatarPath) : null;
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
  const correctionEvidenceUrl = await getPrivateUploadSignedUrl("maha-mantra-evidence", correctionEntry?.maha_mantra_path);
  const today = todayInIndia();
  const month = today.slice(0, 7);
  const pendingLeaves = leaveResult.requests.filter((request) => request.status === "pending").length;
  const awayToday = leaveResult.requests.some((request) => request.status === "approved" && request.start_date <= today && request.end_date >= today);
  const leaveHref = actor.role === "super_admin" ? `/admin/leaves?month=${month}&studentId=${student.id}` : `/mentor/leaves?month=${month}&studentId=${student.id}`;
  return (
    <main className="page-container">
      <header className="page-heading student-profile-heading"><ProfileAvatar name={student.full_name} src={avatarUrl} size={72} className="profile-heading-avatar" /><div className="student-profile-identity"><p className="eyebrow">Student Trends</p><h1>{student.full_name}<span className={`profile-status-mark ${student.is_active ? "profile-status-active" : "profile-status-inactive"}`} title={student.is_active ? "Active Student" : "Inactive Student"}>{student.is_active ? <CircleCheck size={20} aria-hidden="true" /> : <CircleX size={20} aria-hidden="true" />}<span className="visually-hidden">{student.is_active ? "Active Student" : "Inactive Student"}</span></span></h1><p>{student.email} · {student.academy_label ?? "No academy label"}</p>{student.student_group ? actor.role === "super_admin" ? <StudentGroupForm studentId={student.id} studentGroup={student.student_group} /> : <div className="student-birthdate-summary"><span><small>Student group</small><strong>{studentGroupLabel(student.student_group)}</strong></span></div> : <p className="field-hint">Student group editing is unavailable until the student group migration is applied.</p>}{enhancements.available ? <StudentBirthDateForm studentId={student.id} birthDate={enhancements.birthDate} displayBirthDate={enhancements.birthDate ? displayDate(enhancements.birthDate) : null} maxDate={todayInIndia()} /> : <p className="field-hint">Birthdate editing is available after the profile migration.</p>}</div><div className="student-profile-tools"><form className="student-range-filter" method="get"><div className="field"><label htmlFor="range">Report Range</label><select id="range" name="range" defaultValue={String(range)}><option value="7">7 Days</option><option value="30">30 Days</option><option value="90">90 Days</option></select></div><button className="button button-secondary button-small" type="submit">Apply</button></form>{actor.role === "super_admin" ? <Link className="button" href="/admin/students/new">Add Student</Link> : null}</div></header>
      <section className={`student-overview-grid section-gap-small${personalGrowth ? "" : " student-overview-grid-single"}`}>
        <section className="metric-grid student-detail-metrics" aria-label="Student Summary"><article className="metric-card"><span>{range}-day entries</span><strong>{entries.length}</strong></article><article className="metric-card"><span>Average sleep</span><strong>{formatMinutes(average(entries.map((entry) => sleepDurationMinutes(entry.sleep_time, entry.wake_time))))}</strong></article><article className="metric-card"><span>Total study</span><strong>{formatMinutes(totalStudy)}</strong></article><article className="metric-card"><span>Total chanting</span><strong>{totalRounds === null ? "—" : `${totalRounds} rounds`}</strong></article></section>
        {personalGrowth ? <section className="panel student-growth-summary"><div className="panel-title"><h2>Growth Score</h2><span>{activeGrowth ? `Rank #${activeGrowth.rank}` : "Historical report"}</span></div><GrowthScoreCards scores={personalGrowth} /></section> : null}
      </section>
      <section className="panel section-gap-small"><div className="panel-title"><div><h2>Home Leave</h2><span>Applications and approved days for this Student.</span></div><Link href={leaveHref}>View All Leave</Link></div>{leaveResult.available ? <><div className="student-mini-stats"><span><b>{pendingLeaves}</b>Pending</span><span><b>{awayToday ? "Yes" : "No"}</b>Away Today</span><span><b>{approvedLeaveDaysInMonth(leaveResult.requests, month)}</b>Home Days This Month</span><span><b>{leaveResult.requests.length}</b>Total Applications</span></div>{leaveResult.requests.length ? <div className="table-wrap leave-profile-table"><table><thead><tr><th>Dates</th><th>Reason</th><th>Status / Decision</th></tr></thead><tbody>{leaveResult.requests.slice(0, 3).map((request) => <tr key={request.id}><td>{displayDate(request.start_date)} – {displayDate(request.end_date)}</td><td>{request.reason}</td><td><LeaveDecisionControls requestId={request.id} studentName={student.full_name} status={request.status} decisionNote={request.decision_note} canDecide={actor.role === "super_admin"} /></td></tr>)}</tbody></table></div> : <p className="empty-state compact-empty">No leave applications from this Student.</p>}</> : <p className="field-hint">Available after the leave migration.</p>}</section>
      {personalGrowth ? <section className="content-grid"><article className="panel"><div className="panel-title"><h2>Overall score trend</h2></div><OverallGrowthChart data={growthChartData} /></article><article className="panel"><div className="panel-title"><h2>Category comparison</h2></div><CategoryGrowthChart scores={personalGrowth} /></article></section> : null}
      <section className="panel section-gap"><div className="panel-title"><div><h2>Mentor correction</h2><span>Authorized staff may correct the last 90 days.</span></div></div><form className="filters" method="get"><input type="hidden" name="range" value={range} /><div className="field"><label htmlFor="date">Entry date</label><input id="date" name="date" type="date" min={daysAgoInIndia(89)} max={todayInIndia()} defaultValue={correctionDate} /></div><button className="button button-secondary">Load entry</button></form><DailyEntryForm key={correctionDate} studentId={student.id} ownerStudentId={student.id} selectedDate={correctionDate} entry={correctionEntry} evidenceUrl={correctionEvidenceUrl} minDate={daysAgoInIndia(89)} maxDate={todayInIndia()} /></section>
      <section className="panel section-gap"><div className="panel-title"><h2>{range}-day trend</h2></div><TrendChart data={chartData} /></section>
      <section className="panel section-gap"><div className="panel-title"><h2>Daily records</h2></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Bedtime</th><th>Wake-up</th><th>Sleep</th><th>Study</th><th>Rounds</th><th>Morning Arati</th><th>Gita class</th><th>Reading</th><th>Class attended</th><th>Seva</th><th>Note</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{displayDate(entry.entry_date)}</td><td>{entry.sleep_time.slice(0, 5)}</td><td>{entry.wake_time.slice(0, 5)}</td><td>{formatMinutes(sleepDurationMinutes(entry.sleep_time, entry.wake_time))}</td><td>{formatMinutes(entry.study_minutes)}</td><td>{entry.chanting_rounds ?? "—"}</td><td>{entry.morning_arati_status ?? (entry.morning_arati_attended ? "present" : "absent")}{entry.maha_mantra_path ? " · Evidence" : ""}</td><td>{entry.gita_class_status.replace("_", " ")}</td><td>{entry.evening_reading_minutes}m</td><td>{entry.library_attended ? "Yes" : "No"}</td><td>{entry.seva_minutes}m</td><td>{entry.note ?? "—"}</td></tr>)}</tbody></table>{entries.length === 0 ? <p className="empty-state">No entries in this range.</p> : null}</div></section>
      <p className="security-note section-gap">“Seva &amp; Character” is calculated from self-reported seva minutes; it is not a subjective character assessment.</p>
    </main>
  );
}
