import type { Metadata } from "next";
import Link from "next/link";
import { DailyEntryForm } from "@/components/daily-entry-form";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate, isWithinStudentEntryWindow, todayInIndia } from "@/lib/date";
import { getEntries, getPrivateUploadSignedUrl } from "@/lib/data";

export const metadata: Metadata = { title: "Daily entry" };

export default async function StudentEntryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const profile = await requireProfile(["student"]);
  const params = await searchParams;
  const today = todayInIndia();
  const yesterday = daysAgoInIndia(1);
  const selectedDate = params.date && isWithinStudentEntryWindow(params.date) ? params.date : today;
  const entries = await getEntries({ startDate: daysAgoInIndia(89), studentId: profile.id });
  const selected = entries.find((entry) => entry.entry_date === selectedDate);
  const evidenceUrl = await getPrivateUploadSignedUrl("maha-mantra-evidence", selected?.maha_mantra_path);
  return <main className="page-container"><header className="page-heading"><div><p className="eyebrow">Daily Sadhana</p><h1>{selected ? `Edit ${displayDate(selectedDate)}` : "Fill Daily Entry"}</h1><p>You can update today and yesterday only.</p></div><Link className="button button-secondary" href="/student">Back to Dashboard</Link></header><section className="panel narrow-panel"><div className="date-switcher" role="navigation" aria-label="Entry date"><Link className={`button ${selectedDate === today ? "" : "button-secondary"}`} aria-current={selectedDate === today ? "page" : undefined} href={`/student/entry?date=${today}`}>Today</Link><Link className={`button ${selectedDate === yesterday ? "" : "button-secondary"}`} aria-current={selectedDate === yesterday ? "page" : undefined} href={`/student/entry?date=${yesterday}`}>Yesterday</Link></div><DailyEntryForm key={selectedDate} ownerStudentId={profile.id} selectedDate={selectedDate} entry={selected} evidenceUrl={evidenceUrl} minDate={yesterday} maxDate={today} /></section><section className="panel section-gap"><div className="panel-title"><h2>Recent History</h2><span>Older entries are read-only</span></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Morning Arati</th><th>Study</th><th>Rounds</th></tr></thead><tbody>{entries.slice(0, 14).map((entry) => <tr key={entry.id}><td>{displayDate(entry.entry_date)}</td><td>{entry.morning_arati_status ?? (entry.morning_arati_attended ? "present" : "absent")}</td><td>{entry.study_minutes} min</td><td>{entry.chanting_rounds ?? "—"}</td></tr>)}</tbody></table>{!entries.length ? <div className="empty-state"><strong>No Entries Yet</strong><p>Your submitted daily entries will appear here.</p></div> : null}</div></section></main>;
}
