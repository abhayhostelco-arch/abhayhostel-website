import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { GitaAttendanceForm } from "@/components/gita-attendance-form";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate, todayInIndia } from "@/lib/date";
import { getGitaAttendance, getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Gita attendance" };

export default async function GitaAttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const requestedDate = (await searchParams).date;
  const minDate = daysAgoInIndia(89);
  const maxDate = todayInIndia();
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= minDate && requestedDate <= maxDate ? requestedDate : maxDate;
  const students = await getProfiles("student", true);
  const attendance = await getGitaAttendance(date, students.map((student) => student.id));
  const records = attendance.records.filter((record) => record.attendance_date === date);
  return <main className="page-container">
    <header className="page-heading hero-heading"><div><p className="eyebrow">Official register</p><h1>Gita Class Attendance</h1><p>{actor.role === "super_admin" ? "Record attendance for all active students." : "Record attendance for your assigned active students."} This register is separate from student-reported scoring.</p></div></header>
    <section className="panel attendance-date-panel">
      <form className="filters" method="get"><div className="field"><label htmlFor="date">Attendance date</label><input id="date" name="date" type="date" min={minDate} max={maxDate} defaultValue={date} /></div><button className="button button-secondary"><CalendarDays size={17} aria-hidden="true" /> Load Date</button></form>
      <span className="status-pill status-neutral">{displayDate(date)}</span>
    </section>
    <section className="panel section-gap">
      <div className="panel-title"><div><h2>Complete attendance sheet</h2><span>Saving updates all listed students together.</span></div><span>{records.length ? `${records.length}/${students.length} previously recorded` : "Not recorded"}</span></div>
      {!attendance.available ? <div className="empty-state unavailable-state"><strong>Official attendance is not available yet</strong><p>The new attendance migration must be applied before staff can load or save this register.</p></div>
        : students.length ? <GitaAttendanceForm key={date} students={students} records={records} attendanceDate={date} />
          : <div className="empty-state"><strong>No eligible students</strong><p>{actor.role === "admin" ? "No active students are assigned to you." : "There are no active students to record."}</p></div>}
    </section>
  </main>;
}
