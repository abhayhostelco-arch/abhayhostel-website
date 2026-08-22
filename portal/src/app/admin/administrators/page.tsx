import type { Metadata } from "next";
import { AccountForm } from "@/components/account-form";
import { AccountResetForm } from "@/components/account-reset-form";
import { ReauthForm } from "@/components/reauth-form";
import { RoleBadge } from "@/components/role-badge";
import { setAccountActiveAction } from "@/app/actions/accounts";
import { requireProfile } from "@/lib/auth";
import { getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Administrators" };

export default async function AdministratorsPage() {
  const actor = await requireProfile(["super_admin"]);
  const administrators = (await getProfiles()).filter((profile) => profile.role !== "student");
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Privileged access</p><h1>Administrators</h1><p>Confirm your password before changing privileged accounts.</p></div></header>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-title"><h2>Administrator directory</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {administrators.map((administrator) => (
                  <tr key={administrator.id}>
                    <td><strong>{administrator.full_name}</strong><br /><small>{administrator.email}</small></td>
                    <td><RoleBadge role={administrator.role} /></td>
                    <td><span className={`status-pill ${administrator.is_active ? "status-success" : "status-danger"}`}>{administrator.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      {administrator.id === actor.id || administrator.role === "super_admin" ? "Protected" : (
                        <div className="actions-row">
                          <form action={setAccountActiveAction}>
                            <input type="hidden" name="targetId" value={administrator.id} />
                            <input type="hidden" name="active" value={administrator.is_active ? "false" : "true"} />
                            <button className="button button-danger button-small" type="submit">{administrator.is_active ? "Deactivate" : "Reactivate"}</button>
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
        <div className="stack">
          <aside className="panel"><div className="panel-title"><h2>Unlock sensitive actions</h2></div><ReauthForm /></aside>
          <aside className="panel"><div className="panel-title"><h2>Create administrator</h2></div><AccountForm role="admin" /></aside>
        </div>
      </section>
    </main>
  );
}
