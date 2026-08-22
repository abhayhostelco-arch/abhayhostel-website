import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Clock3, MoonStar, Sunrise } from "lucide-react";
import { DailyEntryForm } from "@/components/daily-entry-form";
import { GrowthScoreCards } from "@/components/growth-score-cards";
import { TrendChart } from "@/components/trend-chart";
import { requireProfile } from "@/lib/auth";
import { average, formatMinutes, sleepDurationMinutes, total, totalRecorded } from "@/lib/analytics";
import { daysAgoInIndia, displayDate, isWithinEntryWindow, todayInIndia } from "@/lib/date";
import { getEntries, getScoreSettings } from "@/lib/data";
import { scoreDailyEntry } from "@/lib/growth-score";

export const metadata: Metadata = { title: "Daily tracker" };

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; range?: string }>;
}) {
  const profile = await requireProfile(["student"]);
  const params = await searchParams;
  const today = todayInIndia();
  const minDate = daysAgoInIndia(89);
  const selectedDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && isWithinEntryWindow(params.date)
      ? params.date
      : today;
  const range = params.range === "7" || params.range === "90" ? Number(params.range) : 30;
  const [entries, scoreSettings] = await Promise.all([getEntries({ startDate: minDate, studentId: profile.id }), getScoreSettings()]);
  const selected = entries.find((entry) => entry.entry_date === selectedDate);
  const periodEntries = entries.filter((entry) => entry.entry_date >= daysAgoInIndia(range - 1));
  const avgSleep = average(
    periodEntries.map((entry) => sleepDurationMinutes(entry.sleep_time, entry.wake_time)),
  );
  const totalStudy = total(periodEntries.map((entry) => entry.study_minutes));
  const totalRounds = totalRecorded(periodEntries.map((entry) => entry.chanting_rounds));
  const todayEntry = entries.find((entry) => entry.entry_date === today);
  const todayScore = todayEntry && today >= scoreSettings.score_start_date ? scoreDailyEntry(todayEntry, scoreSettings) : null;
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

      <section className="panel" aria-labelledby="today-summary-title">
        <div className="panel-title"><h2 id="today-summary-title">Today’s routine</h2></div>
        <div className="metric-grid">
          <article className="metric-card"><span>Bedtime</span><strong>{todayEntry?.sleep_time.slice(0, 5) ?? "—"}</strong></article>
          <article className="metric-card"><span>Wake-up</span><strong>{todayEntry?.wake_time.slice(0, 5) ?? "—"}</strong></article>
          <article className="metric-card"><span>Sleep duration</span><strong>{todayEntry ? formatMinutes(sleepDurationMinutes(todayEntry.sleep_time, todayEntry.wake_time)) : "—"}</strong></article>
          <article className="metric-card"><span>Study today</span><strong>{todayEntry ? formatMinutes(todayEntry.study_minutes) : "—"}</strong></article>
          <article className="metric-card"><span>Chanting rounds</span><strong>{todayEntry?.chanting_rounds ?? "—"}</strong></article>
          <article className="metric-card"><span>Gita class</span><strong>{todayEntry ? todayEntry.gita_class_status.replace("_", " ") : "—"}</strong></article>
        </div>
      </section>

      <section className="panel section-gap-small" aria-labelledby="today-score-title">
        <div className="panel-title"><h2 id="today-score-title">Today’s Growth Score</h2><Link href="/student/progress">View progress report</Link></div>
        {todayScore ? <GrowthScoreCards scores={todayScore} /> : <p className="empty-state">Submit today’s routine to calculate your Growth Score.</p>}
      </section>

      <section className="panel section-gap-small">
        <form className="filters" method="get">
          <input type="hidden" name="date" value={selectedDate} />
          <div className="field">
            <label htmlFor="range">Summary period</label>
            <select id="range" name="range" defaultValue={String(range)}>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          <button className="button button-secondary" type="submit">Update summary</button>
        </form>
      </section>

      <section className="metric-grid section-gap-small" aria-label={`${range}-day summary`}>
        <article className="metric-card">
          <span><BookOpenCheck size={14} /> Entries</span>
          <strong>{periodEntries.length}/{range}</strong>
        </article>
        <article className="metric-card">
          <span><MoonStar size={14} /> Average sleep</span>
          <strong>{formatMinutes(avgSleep)}</strong>
        </article>
        <article className="metric-card">
          <span><Clock3 size={14} /> Total study</span>
          <strong>{formatMinutes(totalStudy)}</strong>
        </article>
        <article className="metric-card">
          <span><Sunrise size={14} /> Total chanting</span>
          <strong>{totalRounds === null ? "—" : `${totalRounds} rounds`}</strong>
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
                <th>Date</th><th>Bedtime</th><th>Wake-up</th><th>Sleep</th><th>Study</th><th>Rounds</th><th>Arati</th><th>Gita class</th><th>Reading</th><th>Library</th><th>Seva</th><th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{displayDate(entry.entry_date)}</td>
                  <td>{entry.sleep_time.slice(0, 5)}</td>
                  <td>{entry.wake_time.slice(0, 5)}</td>
                  <td>{formatMinutes(sleepDurationMinutes(entry.sleep_time, entry.wake_time))}</td>
                  <td>{formatMinutes(entry.study_minutes)}</td>
                  <td>{entry.chanting_rounds ?? "—"}</td>
                  <td>{entry.morning_arati_attended ? "Yes" : "No"}</td>
                  <td><span className={`status-pill ${entry.gita_class_status === "absent" ? "status-danger" : "status-success"}`}>{entry.gita_class_status.replace("_", " ")}</span></td>
                  <td>{entry.evening_reading_minutes}m</td>
                  <td>{entry.library_attended ? "Yes" : "No"}</td>
                  <td>{entry.seva_minutes}m</td>
                  <td><Link className="button button-secondary button-small" href={`/student?date=${entry.entry_date}&range=${range}`}>Edit</Link></td>
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
