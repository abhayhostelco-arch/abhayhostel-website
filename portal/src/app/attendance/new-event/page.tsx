import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAttendanceEventAction } from "@/app/actions/workflows";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";

export default async function NewAttendanceEventPage() {
  const profile = await requireProfile(["super_admin"]);
  return <PortalShell profile={profile}><main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">Operations / Attendance</p><h1>Create Event</h1><p>Define an attendance register and its available statuses.</p></div><Link className="button button-secondary" href="/attendance"><ArrowLeft size={17} aria-hidden="true" /> Back to Attendance</Link></header><section className="panel form-surface"><form action={createAttendanceEventAction} className="form-stack"><div className="field"><label htmlFor="event-name">Event Name</label><input id="event-name" name="name" required maxLength={120} autoComplete="off" /></div><div className="field"><label htmlFor="statuses">Statuses</label><input id="statuses" name="statuses" defaultValue="Present, Absent, Late" required autoComplete="off" /><p className="field-hint">Separate up to 8 options with commas.</p></div><div className="form-actions"><Link className="button button-secondary" href="/attendance">Cancel</Link><button className="button">Create Event</button></div></form></section></main></PortalShell>;
}
