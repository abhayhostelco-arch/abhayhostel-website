import type { AppRole } from "@/lib/types";

export const roleLabels: Record<AppRole, string> = {
  super_admin: "Admin",
  admin: "Mentor",
  student: "Student",
};

export function homeForRole(role: AppRole): string {
  if (role === "super_admin") return "/admin";
  if (role === "admin") return "/mentor";
  return "/student";
}

export function studentProfilePath(role: "super_admin" | "admin", studentId: string): string {
  return role === "super_admin" ? `/admin/students/${studentId}` : `/mentor/students/${studentId}`;
}
