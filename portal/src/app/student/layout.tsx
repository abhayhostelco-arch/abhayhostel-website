import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { requireProfile } from "@/lib/auth";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile(["student"]);
  return <PortalShell profile={profile}>{children}</PortalShell>;
}
