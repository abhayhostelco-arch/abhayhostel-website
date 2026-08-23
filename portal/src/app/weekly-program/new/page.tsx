import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createWeeklyProgramAction } from "@/app/actions/workflows";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";
import { todayInIndia } from "@/lib/date";

export default async function NewWeeklyProgramPage() {
  const profile = await requireProfile(["super_admin"]);
  return <PortalShell profile={profile}><main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">Operations / Weekly Program</p><h1>Open Session</h1><p>Students can submit attendance while this session remains active.</p></div><Link className="button button-secondary" href="/weekly-program"><ArrowLeft size={17} aria-hidden="true" /> Back to Weekly Program</Link></header><section className="panel form-surface"><form action={createWeeklyProgramAction} className="form-stack"><div className="field"><label htmlFor="programDate">Program Date</label><input id="programDate" name="programDate" type="date" min={todayInIndia()} required /></div><div className="form-actions"><Link className="button button-secondary" href="/weekly-program">Cancel</Link><button className="button">Open Session</button></div></form></section></main></PortalShell>;
}
