import Link from "next/link";
import { ExternalLink, FileText, Pencil } from "lucide-react";
import { toggleResourceAction } from "@/app/actions/workflows";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";
import { getSharedResources } from "@/lib/data";

export default async function ResourcesPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "super_admin";
  const resources = await getSharedResources(isAdmin);
  return <PortalShell profile={profile}><main className="page-container"><header className="page-heading hero-heading"><div><p className="eyebrow">Operations / Learning Library</p><h1>Shared Resources</h1><p>Readings, classes, and references selected by the hostel Admin.</p></div>{isAdmin ? <Link className="button" href="/resources/new">Add Resource</Link> : null}</header>
    <section>
      <article className="panel"><div className="panel-title"><h2>Resource Library</h2><span>{resources.filter((item) => item.is_published).length} published</span></div><div className="resource-grid">{resources.map((resource) => <article className={`resource-card ${resource.is_published ? "" : "resource-archived"}`} key={resource.id}><FileText size={22} aria-hidden="true" /><div><span className="resource-category">{resource.category ?? "General"}</span><h3>{resource.title}</h3><Link href={resource.url} target="_blank" rel="noopener noreferrer">Open Resource <ExternalLink size={14} aria-hidden="true" /></Link></div>{isAdmin ? <div className="resource-admin-actions"><Link className="button button-secondary button-small" href={`/resources/${resource.id}/edit`}><Pencil size={14} aria-hidden="true" /> Edit</Link><form action={toggleResourceAction}><input type="hidden" name="resourceId" value={resource.id} /><input type="hidden" name="published" value={resource.is_published ? "false" : "true"} />{resource.is_published ? <ConfirmSubmitButton className="button button-secondary button-small" message={`Archive “${resource.title}”? It will no longer be visible to Mentors or Students.`}>Archive</ConfirmSubmitButton> : <button className="button button-secondary button-small">Publish</button>}</form></div> : null}</article>)}{!resources.length ? <div className="empty-state"><FileText size={28} aria-hidden="true" /><strong>No Resources Yet</strong><p>{isAdmin ? "Add the first resource to start the library." : "Published resources will appear here."}</p></div> : null}</div></article>
    </section>
  </main></PortalShell>;
}
