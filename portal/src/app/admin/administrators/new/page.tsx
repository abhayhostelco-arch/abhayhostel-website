import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Add Mentor" };

export default async function NewMentorPage() {
  await requireProfile(["super_admin"]);
  return <main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">People / Mentors</p><h1>Add Mentor</h1><p>Create secure Mentor access for a student group.</p></div><Link className="button button-secondary" href="/admin/administrators"><ArrowLeft size={17} aria-hidden="true" /> Back to Mentors</Link></header><section className="panel form-surface"><div className="form-section-heading"><span>01</span><div><h2>Mentor Details</h2><p>The temporary password appears once after creation.</p></div></div><AccountForm role="admin" /></section></main>;
}
