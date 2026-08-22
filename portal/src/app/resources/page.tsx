import Link from "next/link";
import { ExternalLink, FileText, Plus } from "lucide-react";
import { saveResourceAction, toggleResourceAction } from "@/app/actions/workflows";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";
import { getSharedResources } from "@/lib/data";

export default async function ResourcesPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "super_admin";
  const resources = await getSharedResources(isAdmin);
  return <PortalShell profile={profile}><main className="page-container"><header className="page-heading hero-heading"><div><p className="eyebrow">Learning library</p><h1>Shared Resources</h1><p>Useful readings, classes, and references selected by the hostel Admin.</p></div></header>
    <section className={isAdmin ? "content-grid" : undefined}>
      <article className="panel"><div className="panel-title"><h2>Resource library</h2><span>{resources.filter((item) => item.is_published).length} published</span></div><div className="resource-grid">{resources.map((resource) => <article className={`resource-card ${resource.is_published ? "" : "resource-archived"}`} key={resource.id}><FileText size={22} aria-hidden="true" /><div><span className="resource-category">{resource.category ?? "General"}</span><h3>{resource.title}</h3><Link href={resource.url} target="_blank" rel="noopener noreferrer">Open resource <ExternalLink size={14} /></Link></div>{isAdmin ? <div className="resource-admin-actions"><form action={toggleResourceAction}><input type="hidden" name="resourceId" value={resource.id} /><input type="hidden" name="published" value={resource.is_published ? "false" : "true"} /><button className="button button-secondary button-small">{resource.is_published ? "Archive" : "Publish"}</button></form><details><summary>Edit</summary><form action={saveResourceAction} className="form-stack"><input type="hidden" name="resourceId" value={resource.id} /><div className="field"><label>Title<input name="title" defaultValue={resource.title} required /></label></div><div className="field"><label>Link<input name="url" type="url" defaultValue={resource.url} required /></label></div><div className="field"><label>Category<input name="category" defaultValue={resource.category ?? ""} /></label></div><label className="checkbox-row"><input name="published" type="checkbox" defaultChecked={resource.is_published} /> Published</label><button className="button button-small">Save</button></form></details></div> : null}</article>)}{!resources.length ? <p className="empty-state">No resources have been published yet.</p> : null}</div></article>
      {isAdmin ? <aside className="panel"><div className="panel-title"><h2><Plus size={18} /> Add resource</h2></div><form action={saveResourceAction} className="form-stack"><div className="field"><label htmlFor="resource-title">Title</label><input id="resource-title" name="title" required maxLength={160} /></div><div className="field"><label htmlFor="resource-url">HTTP or HTTPS link</label><input id="resource-url" name="url" type="url" required maxLength={2048} /></div><div className="field"><label htmlFor="resource-category">Category</label><input id="resource-category" name="category" maxLength={80} /></div><label className="checkbox-row"><input name="published" type="checkbox" defaultChecked /> Publish immediately</label><button className="button">Add resource</button></form></aside> : null}
    </section>
  </main></PortalShell>;
}
