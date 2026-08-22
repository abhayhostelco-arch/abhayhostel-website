import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/account-form";
import { AccountResetForm } from "@/components/account-reset-form";
import { assignStudentMentorAction, setAccountActiveAction } from "@/app/actions/accounts";
import { requireProfile } from "@/lib/auth";
import { displayDate } from "@/lib/date";
import { getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase().slice(0, 120);
  const status = params.status === "inactive" ? "inactive" : params.status === "all" ? "all" : "active";
  const [allStudents, mentors] = await Promise.all([getProfiles("student"), actor.role === "super_admin" ? getProfiles("admin") : Promise.resolve([])]);
  const students = allStudents.filter((student) => {
    const searchMatch = !query || `${student.full_name} ${student.email} ${student.academy_label ?? ""}`.toLowerCase().includes(query);
    const statusMatch = status === "all" || student.is_active === (status === "active");
    return searchMatch && statusMatch;
  });

  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">{actor.role === "super_admin" ? "Accounts & assignments" : "Mentor workspace"}</p><h1>{actor.role === "super_admin" ? "Students" : "My students"}</h1><p>{actor.role === "super_admin" ? "Create students, assign Mentors, and manage access." : "Review, correct, and support your assigned students."}</p></div></header>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-title"><h2>Student directory</h2></div>
          <form className="filters" method="get">
            <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={params.q ?? ""} maxLength={120} /></div>
            <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={status}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select></div>
            <button className="button button-secondary" type="submit">Apply filters</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Mentor</th><th>Academy</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td><strong>{student.full_name}</strong><br /><small>{student.email}</small></td>
                    <td>{mentors.find((mentor) => mentor.id === student.mentor_id)?.full_name ?? (actor.role === "admin" ? actor.full_name : "Unassigned")}{actor.role === "super_admin" ? <form action={assignStudentMentorAction} className="inline-assignment"><input type="hidden" name="studentId" value={student.id} /><select name="mentorId" aria-label={`Assign Mentor for ${student.full_name}`} defaultValue={student.mentor_id ?? ""} required><option value="" disabled>Choose</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>)}</select><button className="button button-secondary button-small">Assign</button></form> : null}</td>
                    <td>{student.academy_label ?? "—"}</td>
                    <td>{student.joined_on ? displayDate(student.joined_on) : "—"}</td>
                    <td><span className={`status-pill ${student.is_active ? "status-success" : "status-danger"}`}>{student.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      <div className="actions-row">
                        <Link className="button button-secondary button-small" href={`${actor.role === "admin" ? "/mentor" : "/admin"}/students/${student.id}`}>View</Link>
                        <form action={setAccountActiveAction}>
                          <input type="hidden" name="targetId" value={student.id} />
                          <input type="hidden" name="active" value={student.is_active ? "false" : "true"} />
                          <button className={`button button-small ${student.is_active ? "button-danger" : "button-secondary"}`} type="submit">{student.is_active ? "Deactivate" : "Reactivate"}</button>
                        </form>
                        <AccountResetForm targetId={student.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 ? <p className="empty-state">No students match these filters.</p> : null}
          </div>
        </article>
        <div className="stack">
          {actor.role === "super_admin" ? <aside className="panel">
            <div className="panel-title"><h2>Create student</h2></div>
            <AccountForm role="student" mentors={mentors} />
          </aside> : null}
        </div>
      </section>
    </main>
  );
}
