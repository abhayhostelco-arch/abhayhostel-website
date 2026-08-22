import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  redirect(profile.role === "student" ? "/student" : "/admin");
}
