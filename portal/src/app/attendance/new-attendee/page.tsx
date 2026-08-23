import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAttendancePersonAction } from "@/app/actions/workflows";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";
import { getAttendancePeople, getProfiles } from "@/lib/data";

export default async function NewAttendeePage() {
  const profile = await requireProfile(["super_admin"]);
  const [students, people] = await Promise.all([getProfiles("student", true), getAttendancePeople(null)]);
  return <PortalShell profile={profile}><main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">Operations / Attendance</p><h1>Add Attendee</h1><p>Link a Student or add an external devotee.</p></div><Link className="button button-secondary" href="/attendance"><ArrowLeft size={17} aria-hidden="true" /> Back to Attendance</Link></header><section className="panel form-surface"><form action={createAttendancePersonAction} className="form-stack"><div className="field"><label htmlFor="person-profile">Link Student</label><select id="person-profile" name="profileId" defaultValue=""><option value="">External devotee</option>{students.filter((student) => !people.some((person) => person.profile_id === student.id)).map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></div><div className="field"><label htmlFor="person-name">Name</label><input id="person-name" name="name" required maxLength={120} autoComplete="name" /></div><div className="field"><label htmlFor="person-phone">Phone</label><input id="person-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" /></div><div className="field"><label htmlFor="person-notes">Notes</label><textarea id="person-notes" name="notes" maxLength={500} /></div><div className="form-actions"><Link className="button button-secondary" href="/attendance">Cancel</Link><button className="button">Add Attendee</button></div></form></section></main></PortalShell>;
}
