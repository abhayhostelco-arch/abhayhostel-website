import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-form";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect("/");
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
