import type { Metadata } from "next";
import Link from "next/link";
import { DailyEntryForm } from "@/components/daily-entry-form";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate, isWithinStudentEntryWindow, todayInIndia } from "@/lib/date";
import { getEntries } from "@/lib/data";

export const metadata: Metadata = { title: "Daily entry" };

export default async function StudentEntryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const profile = await requireProfile(["student"]);
  const params = await searchParams;
  const today = todayInIndia();
  const yesterday = daysAgoInIndia(1);
  const selectedDate = params.date && isWithinStudentEntryWindow(params.date) ? params.date : today;
  const entries = await getEntries({ startDate: daysAgoInIndia(89), studentId: profile.id });
  const selected = entries.find((entry) => entry.entry_date === selectedDate);
  return <main className="page-container"><header className="page-heading"><div><p className="eyebrow">Daily Sadhana</p><h1>{selected ? `Edit ${displayDate(selectedDate)}` : "Fill daily entry"}</h1><p>Students can update today and yesterday only.</p></div><Link className="button button-secondary" href="/student">Back to dashboard</Link></header><section className="panel narrow-panel"><div className="date-switcher"><Link className={`button ${selectedDate === today ? "" : "button-secondary"}`} href={`/student/entry?date=${today}`}>Today</Link><Link className={`button ${selectedDate === yesterday ? "" : "button-secondary"}`} href={`/student/entry?date=${yesterday}`}>Yesterday</Link></div><DailyEntryForm key={selectedDate} selectedDate={selectedDate} entry={selected} minDate={yesterday} maxDate={today} /></section><section className="panel section-gap"><div className="panel-title"><h2>Recent history</h2><span>Older entries are read-only</span></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Study</th><th>Rounds</th></tr></thead><tbody>{entries.slice(0, 14).map((entry) => <tr key={entry.id}><td>{displayDate(entry.entry_date)}</td><td>Submitted</td><td>{entry.study_minutes} min</td><td>{entry.chanting_rounds}</td></tr>)}</tbody></table></div></section></main>;
}
