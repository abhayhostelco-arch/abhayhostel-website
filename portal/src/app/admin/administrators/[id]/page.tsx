import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CircleCheck, CircleX } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { requireProfile } from "@/lib/auth";
import { getAvatarSignedUrl, getProfileEnhancements, getProfiles } from "@/lib/data";

export const metadata: Metadata = { title: "Mentor profile" };

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile(["super_admin"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [mentors, students] = await Promise.all([getProfiles("admin"), getProfiles("student")]);
  const mentor = mentors.find((profile) => profile.id === id);
  if (!mentor) notFound();
  const enhancements = await getProfileEnhancements(mentor.id);
  const avatarUrl = enhancements.available ? await getAvatarSignedUrl(enhancements.avatarPath) : null;
  const assignedStudents = students.filter((student) => student.mentor_id === mentor.id);
  const activeStudents = assignedStudents.filter((student) => student.is_active);

  return <main className="page-container">
    <header className="page-heading mentor-profile-hero"><ProfileAvatar name={mentor.full_name} src={avatarUrl} size={72} className="profile-heading-avatar" /><div className="mentor-profile-identity"><p className="eyebrow">Mentor Profile</p><h1>{mentor.full_name}<span className={`profile-status-mark ${mentor.is_active ? "profile-status-active" : "profile-status-inactive"}`} title={mentor.is_active ? "Active Mentor" : "Inactive Mentor"}>{mentor.is_active ? <CircleCheck size={20} aria-hidden="true" /> : <CircleX size={20} aria-hidden="true" />}<span className="visually-hidden">{mentor.is_active ? "Active Mentor" : "Inactive Mentor"}</span></span></h1><p>{mentor.email}</p>{mentor.phone ? <p>{mentor.phone}</p> : null}</div><Link className="button button-secondary" href="/admin/administrators">Back to Mentors</Link></header>
    <section className="mentor-profile-metrics section-gap-small" aria-label="Mentor Summary"><article className="mentor-stat-chip"><span>Assigned Students</span><strong>{assignedStudents.length}</strong></article><article className="mentor-stat-chip"><span>Active Students</span><strong>{activeStudents.length}</strong></article></section>
    <section className="panel section-gap"><div className="panel-title"><div><h2>Assigned Students</h2><span>Open a Student profile to review progress and daily records.</span></div></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Academy</th><th>Status</th><th>Profile</th></tr></thead><tbody>{assignedStudents.map((student) => <tr key={student.id}><td><strong>{student.full_name}</strong><br /><small>{student.email}</small></td><td>{student.academy_label ?? "—"}</td><td><span className={`status-pill ${student.is_active ? "status-success" : "status-danger"}`}>{student.is_active ? "Active" : "Inactive"}</span></td><td><Link className="button button-secondary button-small" href={`/admin/students/${student.id}`}>Open Student</Link></td></tr>)}</tbody></table>{!assignedStudents.length ? <div className="empty-state compact-empty"><strong>No Assigned Students</strong><p>Students assigned to this Mentor will appear here.</p></div> : null}</div></section>
  </main>;
}
