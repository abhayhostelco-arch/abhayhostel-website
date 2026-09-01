import type { Metadata } from "next";
import Link from "next/link";
import { AccountResetForm } from "@/components/account-reset-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { StudentReactivationForm } from "@/components/student-reactivation-form";
import { assignStudentMentorAction, setAccountActiveAction } from "@/app/actions/accounts";
import { requireProfile } from "@/lib/auth";
import { displayDate } from "@/lib/date";
import { getProfiles } from "@/lib/data";
import { filterStudentsByGroup, parseStudentGroupFilter, studentGroupLabel, studentGroupOptions } from "@/lib/student-groups";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; mentorId?: string; group?: string }>;
}) {
  const actor = await requireProfile(["super_admin", "admin"]);
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase().slice(0, 120);
  const status = params.status === "inactive" ? "inactive" : params.status === "all" ? "all" : "active";
  const [allStudents, mentors] = await Promise.all([getProfiles("student"), actor.role === "super_admin" ? getProfiles("admin") : Promise.resolve([])]);
  const mentorId = actor.role === "super_admin" && mentors.some((mentor) => mentor.id === params.mentorId) ? params.mentorId : undefined;
  const group = parseStudentGroupFilter(params.group);
  const students = filterStudentsByGroup(allStudents.filter((student) => {
    const searchMatch = !query || `${student.full_name} ${student.email} ${student.academy_label ?? ""}`.toLowerCase().includes(query);
    const statusMatch = status === "all" || student.is_active === (status === "active");
    const mentorMatch = !mentorId || student.mentor_id === mentorId;
    return searchMatch && statusMatch && mentorMatch;
  }), group);

  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">{actor.role === "super_admin" ? "People" : "Mentor workspace"}</p><h1>{actor.role === "super_admin" ? "Students" : "My Students"}</h1><p>{actor.role === "super_admin" ? "Manage student access, Mentor assignments, and hostel records." : "Review, correct, and support your assigned students."}</p></div>{actor.role === "super_admin" ? <Link className="button" href="/admin/students/new">Add Student</Link> : null}</header>
      <section>
        <article className="panel">
          <div className="panel-title"><h2>Student Directory</h2><span>{students.length} {students.length === 1 ? "Student" : "Students"}</span></div>
          <form className="filters" method="get">
            <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={params.q ?? ""} maxLength={120} autoComplete="off" placeholder="Search by name, email, or academy…" /></div>
            <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={status}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select></div>
            <div className="field"><label htmlFor="group">Group</label><select id="group" name="group" defaultValue={group ?? ""}><option value="">All Groups</option>{studentGroupOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            {actor.role === "super_admin" ? <div className="field"><label htmlFor="mentorId">Mentor</label><select id="mentorId" name="mentorId" defaultValue={mentorId ?? ""}><option value="">All Mentors</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>)}</select></div> : null}
            <button className="button button-secondary" type="submit">Apply Filters</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Group</th><th>Mentor</th><th>Academy</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td><Link className="directory-profile-link" href={`${actor.role === "admin" ? "/mentor" : "/admin"}/students/${student.id}`}><span><strong>{student.full_name}</strong><small>{student.email}</small></span><span aria-hidden="true">→</span></Link></td>
                    <td><span className={`status-pill ${student.student_group ? "status-neutral" : "status-danger"}`}>{studentGroupLabel(student.student_group)}</span></td>
                    <td>{mentors.find((mentor) => mentor.id === student.mentor_id)?.full_name ?? (actor.role === "admin" ? actor.full_name : "Unassigned")}{actor.role === "super_admin" ? <form key={`${student.id}:${student.mentor_id ?? "unassigned"}`} action={assignStudentMentorAction} className="inline-assignment"><input type="hidden" name="studentId" value={student.id} /><select name="mentorId" aria-label={`Assign Mentor for ${student.full_name}`} defaultValue={student.mentor_id ?? ""} required><option value="" disabled>Choose</option>{mentors.filter((mentor) => mentor.is_active).map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>)}</select><button className="button button-secondary button-small">Assign</button></form> : null}</td>
                    <td>{student.academy_label ?? "—"}</td>
                    <td>{student.joined_on ? displayDate(student.joined_on) : "—"}</td>
                    <td><span className={`status-pill ${student.is_active ? "status-success" : "status-danger"}`}>{student.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      <div className="actions-row">
                        <Link className="button button-secondary button-small" href={`${actor.role === "admin" ? "/mentor" : "/admin"}/students/${student.id}`}>View</Link>
                        {student.is_active ? <form action={setAccountActiveAction}>
                          <input type="hidden" name="targetId" value={student.id} />
                          <input type="hidden" name="active" value="false" />
                          <ConfirmSubmitButton message={`Deactivate ${student.full_name}? They will no longer be able to sign in.`}>Deactivate</ConfirmSubmitButton>
                        </form> : student.student_group ? <StudentReactivationForm studentId={student.id} studentName={student.full_name} studentGroup={student.student_group} canChangeGroup={actor.role === "super_admin"} /> : <span className="form-error">Apply the Student group migration before reactivation.</span>}
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
      </section>
    </main>
  );
}
