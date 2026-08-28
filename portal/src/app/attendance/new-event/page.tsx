import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AttendanceEventForm } from "@/components/attendance-event-form";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";

export default async function NewAttendanceEventPage() {
  const profile = await requireProfile(["super_admin"]);
  return <PortalShell profile={profile}><main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">Operations / Attendance</p><h1>Create Event</h1><p>Define an attendance register and its available statuses.</p></div><Link className="button button-secondary" href="/attendance"><ArrowLeft size={17} aria-hidden="true" /> Back to Attendance</Link></header><section className="panel form-surface"><AttendanceEventForm /></section></main></PortalShell>;
}
