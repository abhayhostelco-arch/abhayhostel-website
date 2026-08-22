import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile(["super_admin", "admin"]);
  return <PortalShell profile={profile}>{children}</PortalShell>;
}
