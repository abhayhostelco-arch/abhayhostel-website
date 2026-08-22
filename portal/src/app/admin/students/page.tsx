import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/account-form";
import { AccountResetForm } from "@/components/account-reset-form";
import { ReauthForm } from "@/components/reauth-form";
import { setAccountActiveAction } from "@/app/actions/accounts";
import { requireProfile } from "@/lib/auth";
import { displayDate } from "@/lib/date";
import { getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireProfile(["super_admin", "admin"]);
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase().slice(0, 120);
  const status = params.status === "inactive" ? "inactive" : params.status === "all" ? "all" : "active";
  const students = (await getProfiles("student")).filter((student) => {
    const searchMatch = !query || `${student.full_name} ${student.email} ${student.academy_label ?? ""}`.toLowerCase().includes(query);
    const statusMatch = status === "all" || student.is_active === (status === "active");
    return searchMatch && statusMatch;
  });

  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Accounts</p><h1>Students</h1><p>Create credentials, manage access, and inspect individual trends.</p></div></header>
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
              <thead><tr><th>Student</th><th>Academy</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td><strong>{student.full_name}</strong><br /><small>{student.email}</small></td>
                    <td>{student.academy_label ?? "—"}</td>
                    <td>{student.joined_on ? displayDate(student.joined_on) : "—"}</td>
                    <td><span className={`status-pill ${student.is_active ? "status-success" : "status-danger"}`}>{student.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      <div className="actions-row">
                        <Link className="button button-secondary button-small" href={`/admin/students/${student.id}`}>View</Link>
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
          <aside className="panel">
            <div className="panel-title"><h2>Unlock credential resets</h2></div>
            <p>Confirm your password once to enable resets for the next 15 minutes.</p>
            <ReauthForm />
          </aside>
          <aside className="panel">
            <div className="panel-title"><h2>Create student</h2></div>
            <AccountForm role="student" />
          </aside>
        </div>
      </section>
    </main>
  );
}
