import { Crown, GraduationCap, Shield } from "lucide-react";
import type { AppRole } from "@/lib/types";
import { roleLabels } from "@/lib/roles";

export function RoleBadge({ role }: { role: AppRole }) {
  const Icon = role === "super_admin" ? Crown : role === "admin" ? Shield : GraduationCap;
  return (
    <span className={`role-badge role-${role}`}>
      <Icon size={14} aria-hidden="true" />
      {roleLabels[role]}
    </span>
  );
}
