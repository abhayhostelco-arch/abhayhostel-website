import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, Users } from "lucide-react";
import { TrendChart } from "@/components/trend-chart";
import { deriveAlerts } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";
import { getAlertSettings, getEntries, getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  await requireProfile(["super_admin", "admin"]);
  const [students, entries, settings] = await Promise.all([
    getProfiles("student"),
    getEntries({ startDate: daysAgoInIndia(29) }),
    getAlertSettings(),
  ]);
  const active = students.filter((student) => student.is_active);
  const today = todayInIndia();
  const todayEntries = entries.filter((entry) => entry.entry_date === today);
  const submitted = new Set(todayEntries.map((entry) => entry.student_id));
  const alerts = deriveAlerts(active, entries, settings, 7).slice(0, 6);
  const chartData = Array.from({ length: 14 }, (_, index) => {
    const date = daysAgoInIndia(13 - index);
    const count = entries.filter((entry) => entry.entry_date === date).length;
    return {
      date: date.slice(5),
      completion: active.length === 0 ? 0 : Math.round((count / active.length) * 100),
    };
  });

  return (
    <main className="page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Hostel management</p>
          <h1>Today at a glance</h1>
          <p>Submission status and recent routine signals across active students.</p>
        </div>
        <Link className="button" href="/admin/students">Manage students</Link>
      </header>
      <section className="metric-grid">
        <article className="metric-card"><span><Users size={14} /> Active students</span><strong>{active.length}</strong></article>
        <article className="metric-card"><span><CheckCircle2 size={14} /> Submitted today</span><strong>{todayEntries.length}</strong></article>
        <article className="metric-card"><span><Clock3 size={14} /> Missing today</span><strong>{Math.max(active.length - todayEntries.length, 0)}</strong></article>
        <article className="metric-card"><span><BellRing size={14} /> Recent alerts</span><strong>{deriveAlerts(active, entries, settings, 7).length}</strong></article>
      </section>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-title"><h2>14-day completion</h2></div>
          <TrendChart data={chartData} mode="completion" />
        </article>
        <article className="panel">
          <div className="panel-title"><h2>Latest alerts</h2><Link href="/admin/alerts">View all</Link></div>
          <div className="alert-list">
            {alerts.map((alert) => (
              <div className="alert-item" key={alert.id}>
                <BellRing size={18} color="#a63b32" aria-hidden="true" />
                <div><strong>{alert.studentName}</strong><span>{alert.date} · {alert.message}</span></div>
              </div>
            ))}
            {alerts.length === 0 ? <p className="empty-state">No recent alerts.</p> : null}
          </div>
        </article>
      </section>
      <section className="panel section-gap">
        <div className="panel-title"><h2>Today’s completion</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Academy / class</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {active.map((student) => (
                <tr key={student.id}>
                  <td><strong>{student.full_name}</strong><br /><small>{student.email}</small></td>
                  <td>{student.academy_label ?? "—"}</td>
                  <td><span className={`status-pill ${submitted.has(student.id) ? "status-success" : "status-warning"}`}>{submitted.has(student.id) ? "Submitted" : "Pending"}</span></td>
                  <td><Link href={`/admin/students/${student.id}`}>View trends</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
