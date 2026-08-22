import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";

export default async function Home() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  redirect(homeForRole(profile.role));
}
