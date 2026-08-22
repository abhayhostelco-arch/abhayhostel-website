import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return (
    <AuthShell>
      <ChangePasswordForm />
    </AuthShell>
  );
}
