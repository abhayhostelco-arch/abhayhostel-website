import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";

export default async function MentorLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile(["admin"]);
  return <PortalShell profile={profile}>{children}</PortalShell>;
}
