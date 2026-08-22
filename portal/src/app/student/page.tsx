import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Clock3, MoonStar, Sunrise } from "lucide-react";
import { DailyEntryForm } from "@/components/daily-entry-form";
import { TrendChart } from "@/components/trend-chart";
import { requireProfile } from "@/lib/auth";
import { average, formatMinutes, sleepDurationMinutes } from "@/lib/analytics";
import { daysAgoInIndia, displayDate, isWithinEntryWindow, todayInIndia } from "@/lib/date";
import { getEntries } from "@/lib/data";

export const metadata: Metadata = { title: "Daily tracker" };

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireProfile(["student"]);
  const params = await searchParams;
  const today = todayInIndia();
  const minDate = daysAgoInIndia(89);
  const selectedDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && isWithinEntryWindow(params.date)
      ? params.date
      : today;
  const entries = await getEntries({ startDate: minDate, studentId: profile.id });
  const selected = entries.find((entry) => entry.entry_date === selectedDate);
  const lastSeven = entries.filter((entry) => entry.entry_date >= daysAgoInIndia(6));
  const avgSleep = average(
    lastSeven.map((entry) => sleepDurationMinutes(entry.sleep_time, entry.wake_time)),
  );
  const avgStudy = average(lastSeven.map((entry) => entry.study_minutes));
  const todayEntry = entries.find((entry) => entry.entry_date === today);
  const chartData = [...entries]
    .slice(0, 30)
    .reverse()
    .map((entry) => ({
      date: entry.entry_date.slice(5),
      sleepHours: Number(
        (sleepDurationMinutes(entry.sleep_time, entry.wake_time) / 60).toFixed(1),
      ),
      studyHours: Number((entry.study_minutes / 60).toFixed(1)),
    }));

  return (
    <main className="page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Daily routine</p>
          <h1>Hello, {profile.full_name.split(" ")[0]}</h1>
          <p>Record the previous night and today’s academic routine.</p>
        </div>
        <span className={`status-pill ${todayEntry ? "status-success" : "status-warning"}`}>
          {todayEntry ? "Today submitted" : "Today pending"}
        </span>
      </header>

      <section className="metric-grid" aria-label="Seven-day summary">
        <article className="metric-card">
          <span><BookOpenCheck size={14} /> Entries</span>
          <strong>{lastSeven.length}/7</strong>
        </article>
        <article className="metric-card">
          <span><MoonStar size={14} /> Average sleep</span>
          <strong>{formatMinutes(avgSleep)}</strong>
        </article>
        <article className="metric-card">
          <span><Clock3 size={14} /> Average study</span>
          <strong>{formatMinutes(avgStudy)}</strong>
        </article>
        <article className="metric-card">
          <span><Sunrise size={14} /> Latest wake-up</span>
          <strong>{entries[0]?.wake_time.slice(0, 5) ?? "—"}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-title">
            <h2>{selected ? `Edit ${displayDate(selectedDate)}` : "Add daily entry"}</h2>
          </div>
          <DailyEntryForm
            key={selectedDate}
            selectedDate={selectedDate}
            entry={selected}
            minDate={minDate}
            maxDate={today}
          />
        </article>
        <article className="panel">
          <div className="panel-title"><h2>30-day routine trend</h2></div>
          <TrendChart data={chartData} />
        </article>
      </section>

      <section className="panel section-gap">
        <div className="panel-title"><h2>90-day history</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Sleep</th><th>Wake</th><th>Study</th><th>Academy</th><th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{displayDate(entry.entry_date)}</td>
                  <td>{formatMinutes(sleepDurationMinutes(entry.sleep_time, entry.wake_time))}</td>
                  <td>{entry.wake_time.slice(0, 5)}</td>
                  <td>{formatMinutes(entry.study_minutes)}</td>
                  <td><span className={`status-pill ${entry.academy_status === "absent" ? "status-danger" : "status-success"}`}>{entry.academy_status.replace("_", " ")}</span></td>
                  <td><Link className="button button-secondary button-small" href={`/student?date=${entry.entry_date}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 ? <p className="empty-state">No daily entries yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
