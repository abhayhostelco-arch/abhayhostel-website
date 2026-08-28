import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PortalShell } from "@/components/portal-shell";
import { WeeklyProgramForm } from "@/components/weekly-program-form";
import { requireProfile } from "@/lib/auth";
import { todayInIndia } from "@/lib/date";

export default async function NewWeeklyProgramPage() {
  const profile = await requireProfile(["super_admin"]);
  return <PortalShell profile={profile}><main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">Operations / Weekly Program</p><h1>Open Session</h1><p>Students can submit attendance while this session remains active.</p></div><Link className="button button-secondary" href="/weekly-program"><ArrowLeft size={17} aria-hidden="true" /> Back to Weekly Program</Link></header><section className="panel form-surface"><WeeklyProgramForm minDate={todayInIndia()} /></section></main></PortalShell>;
}
