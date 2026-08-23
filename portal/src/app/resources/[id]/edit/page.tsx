import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { saveResourceAction } from "@/app/actions/workflows";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";
import { getSharedResources } from "@/lib/data";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["super_admin"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const resource = (await getSharedResources(true)).find((item) => item.id === id);
  if (!resource) notFound();
  return <PortalShell profile={profile}><main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">Operations / Resources</p><h1>Edit Resource</h1><p>Update the link, category, or publication status.</p></div><Link className="button button-secondary" href="/resources"><ArrowLeft size={17} aria-hidden="true" /> Back to Resources</Link></header><section className="panel form-surface"><form action={saveResourceAction} className="form-stack"><input type="hidden" name="resourceId" value={resource.id} /><div className="field"><label htmlFor="resource-title">Title</label><input id="resource-title" name="title" defaultValue={resource.title} required maxLength={160} autoComplete="off" /></div><div className="field"><label htmlFor="resource-url">HTTP or HTTPS Link</label><input id="resource-url" name="url" type="url" defaultValue={resource.url} required maxLength={2048} autoComplete="url" /></div><div className="field"><label htmlFor="resource-category">Category</label><input id="resource-category" name="category" defaultValue={resource.category ?? ""} maxLength={80} autoComplete="off" /></div><label className="checkbox-row"><input name="published" type="checkbox" defaultChecked={resource.is_published} /> Published</label><div className="form-actions"><Link className="button button-secondary" href="/resources">Cancel</Link><button className="button">Save Resource</button></div></form></section></main></PortalShell>;
}
