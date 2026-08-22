import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TrendChart } from "@/components/trend-chart";
import { average, formatMinutes, sleepDurationMinutes } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate } from "@/lib/date";
import { getEntries, getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Student trends" };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile(["super_admin", "admin"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [students, entries] = await Promise.all([getProfiles("student"), getEntries({ startDate: daysAgoInIndia(89), studentId: id })]);
  const student = students.find((profile) => profile.id === id);
  if (!student) notFound();
  const chartData = [...entries].reverse().map((entry) => ({ date: entry.entry_date.slice(5), sleepHours: Number((sleepDurationMinutes(entry.sleep_time, entry.wake_time) / 60).toFixed(1)), studyHours: Number((entry.study_minutes / 60).toFixed(1)) }));
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Student trends</p><h1>{student.full_name}</h1><p>{student.email} · {student.academy_label ?? "No academy label"}</p></div></header>
      <section className="metric-grid"><article className="metric-card"><span>90-day entries</span><strong>{entries.length}</strong></article><article className="metric-card"><span>Average sleep</span><strong>{formatMinutes(average(entries.map((entry) => sleepDurationMinutes(entry.sleep_time, entry.wake_time))))}</strong></article><article className="metric-card"><span>Average study</span><strong>{formatMinutes(average(entries.map((entry) => entry.study_minutes)))}</strong></article><article className="metric-card"><span>Status</span><strong>{student.is_active ? "Active" : "Inactive"}</strong></article></section>
      <section className="panel section-gap"><div className="panel-title"><h2>90-day trend</h2></div><TrendChart data={chartData} /></section>
      <section className="panel section-gap"><div className="panel-title"><h2>Daily records</h2></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Sleep</th><th>Wake</th><th>Study</th><th>Academy</th><th>Note</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{displayDate(entry.entry_date)}</td><td>{formatMinutes(sleepDurationMinutes(entry.sleep_time, entry.wake_time))}</td><td>{entry.wake_time.slice(0, 5)}</td><td>{formatMinutes(entry.study_minutes)}</td><td>{entry.academy_status.replace("_", " ")}</td><td>{entry.note ?? "—"}</td></tr>)}</tbody></table>{entries.length === 0 ? <p className="empty-state">No entries in this range.</p> : null}</div></section>
    </main>
  );
}
