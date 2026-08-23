import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { deriveAlerts } from "@/lib/analytics";
import { requireProfile } from "@/lib/auth";
import { daysAgoInIndia, displayDate } from "@/lib/date";
import { getAlertSettings, getEntries, getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ range?: string; type?: string }> }) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const params = await searchParams;
  const range = params.range === "30" || params.range === "90" ? Number(params.range) : 7;
  const allowedTypes = ["all", "missing", "sleep", "study", "absence"];
  const type = allowedTypes.includes(params.type ?? "") ? params.type! : "all";
  const students = await getProfiles("student", true);
  const [entries, settings] = await Promise.all([getEntries({ startDate: daysAgoInIndia(range), studentIds: students.map((student) => student.id) }), getAlertSettings()]);
  const alerts = deriveAlerts(students, entries, settings, range).filter((alert) => type === "all" || alert.type === type);
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Insights / Observation</p><h1>Routine Alerts</h1><p>Calculated from the current global rules and submitted records.</p></div><span className={`status-pill ${alerts.length ? "status-warning" : "status-success"}`}>{alerts.length} {alerts.length === 1 ? "alert" : "alerts"}</span></header>
      <section className="panel">
        <form className="filters" method="get">
          <div className="field"><label htmlFor="range">Range</label><select id="range" name="range" defaultValue={String(range)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>
          <div className="field"><label htmlFor="type">Alert type</label><select id="type" name="type" defaultValue={type}>{allowedTypes.map((value) => <option key={value} value={value}>{value === "all" ? "All alerts" : value}</option>)}</select></div>
          <button className="button button-secondary" type="submit">Apply</button>
        </form>
        <div className="alert-list">
          {alerts.map((alert) => (
            <article className="alert-item" key={alert.id}>
              <BellRing size={19} color="#a63b32" aria-hidden="true" />
              <div><strong><Link href={`${actor.role === "admin" ? "/mentor" : "/admin"}/students/${alert.studentId}`}>{alert.studentName}</Link></strong><span>{displayDate(alert.date)} · {alert.type} · {alert.message}</span></div>
            </article>
          ))}
          {alerts.length === 0 ? <div className="empty-state"><BellRing size={28} aria-hidden="true" /><strong>No Alerts Found</strong><p>No routine alerts match the selected filters.</p></div> : null}
        </div>
      </section>
    </main>
  );
}
