import type { Metadata } from "next";
import Link from "next/link";
import { AccountResetForm } from "@/components/account-reset-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { RoleBadge } from "@/components/role-badge";
import { setAccountActiveAction } from "@/app/actions/accounts";
import { requireProfile } from "@/lib/auth";
import { getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Mentors" };

export default async function AdministratorsPage() {
  const actor = await requireProfile(["super_admin"]);
  const administrators = (await getProfiles("admin"));
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">People</p><h1>Mentors</h1><p>Manage the people responsible for student groups and daily guidance.</p></div><Link className="button" href="/admin/administrators/new">Add Mentor</Link></header>
      <section>
        <article className="panel">
          <div className="panel-title"><h2>Mentor directory</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {administrators.map((administrator) => (
                  <tr key={administrator.id}>
                    <td><Link className="directory-profile-link" href={`/admin/administrators/${administrator.id}`}><span><strong>{administrator.full_name}</strong><small>{administrator.email}</small></span><span aria-hidden="true">→</span></Link></td>
                    <td><RoleBadge role={administrator.role} /></td>
                    <td><span className={`status-pill ${administrator.is_active ? "status-success" : "status-danger"}`}>{administrator.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      {administrator.id === actor.id || administrator.role === "super_admin" ? "Protected" : (
                        <div className="actions-row">
                          <form action={setAccountActiveAction}>
                            <input type="hidden" name="targetId" value={administrator.id} />
                            <input type="hidden" name="active" value={administrator.is_active ? "false" : "true"} />
                            {administrator.is_active ? <ConfirmSubmitButton message={`Deactivate ${administrator.full_name}? Assigned Students will remain linked until reassigned.`}>Deactivate</ConfirmSubmitButton> : <button className="button button-secondary button-small" type="submit">Reactivate</button>}
                          </form>
                          <AccountResetForm targetId={administrator.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
