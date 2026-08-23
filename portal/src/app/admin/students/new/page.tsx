import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { requireProfile } from "@/lib/auth";
import { getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Add Student" };

export default async function NewStudentPage() {
  await requireProfile(["super_admin"]);
  const mentors = await getProfiles("admin");
  return <main className="page-container form-page"><header className="page-heading"><div><p className="eyebrow">People / Students</p><h1>Add Student</h1><p>Create portal access and assign an active Mentor.</p></div><Link className="button button-secondary" href="/admin/students"><ArrowLeft size={17} aria-hidden="true" /> Back to Students</Link></header><section className="panel form-surface"><div className="form-section-heading"><span>01</span><div><h2>Student Details</h2><p>Use the student’s primary contact and hostel information.</p></div></div><AccountForm role="student" mentors={mentors} /></section></main>;
}
