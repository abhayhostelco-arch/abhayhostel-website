import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { saveResourceAction } from "@/app/actions/workflows";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";

export default async function NewResourcePage() {
  const profile = await requireProfile(["super_admin"]);
  return <PortalShell profile={profile}><main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">Operations / Resources</p><h1>Add Resource</h1><p>Publish a trusted link for Mentors and Students.</p></div><Link className="button button-secondary" href="/resources"><ArrowLeft size={17} aria-hidden="true" /> Back to Resources</Link></header><section className="panel form-surface"><form action={saveResourceAction} className="form-stack"><div className="field"><label htmlFor="resource-title">Title</label><input id="resource-title" name="title" required maxLength={160} autoComplete="off" /></div><div className="field"><label htmlFor="resource-url">HTTP or HTTPS Link</label><input id="resource-url" name="url" type="url" required maxLength={2048} autoComplete="url" /></div><div className="field"><label htmlFor="resource-category">Category</label><input id="resource-category" name="category" maxLength={80} autoComplete="off" /></div><label className="checkbox-row"><input name="published" type="checkbox" defaultChecked /> Publish immediately</label><div className="form-actions"><Link className="button button-secondary" href="/resources">Cancel</Link><button className="button">Add Resource</button></div></form></section></main></PortalShell>;
}
