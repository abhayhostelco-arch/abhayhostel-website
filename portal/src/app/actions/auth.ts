"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, Profile } from "@/lib/types";
import {
  changePasswordSchema,
  flattenErrors,
  forgotPasswordSchema,
  loginSchema,
} from "@/lib/validation";
import { getServerEnv } from "@/lib/env";

const genericLoginError = "Unable to sign in with those details.";

export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    captchaToken: formData.get("captchaToken") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: genericLoginError };
  }

  let destination: "/change-password" | "/student" | "/admin";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      options: parsed.data.captchaToken
        ? { captchaToken: parsed.data.captchaToken }
        : undefined,
    });
    if (error || !data.user) return { status: "error", message: genericLoginError };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      return { status: "error", message: genericLoginError };
    }

    const typedProfile = profile as Profile;
    destination = typedProfile.must_change_password
      ? "/change-password"
      : typedProfile.role === "student"
        ? "/student"
        : "/admin";
  } catch {
    return { status: "error", message: genericLoginError };
  }
  redirect(destination);
}

export async function forgotPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
    captchaToken: formData.get("captchaToken") || undefined,
  });
  const message =
    "If that email belongs to an active account, password-reset instructions will be sent.";
  if (!parsed.success) return { status: "success", message };

  try {
    const env = getServerEnv();
    const { data: activeProfile } = await createAdminClient()
      .from("profiles")
      .select("id")
      .eq("email", parsed.data.email)
      .eq("is_active", true)
      .maybeSingle();
    if (!activeProfile) return { status: "success", message };
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/change-password`,
      captchaToken: parsed.data.captchaToken,
    });
  } catch {
    // Deliberately return the same response to prevent account enumeration.
  }
  return { status: "success", message };
}

export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: flattenErrors(parsed.error) };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "Your session has expired." };

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { status: "error", message: "Password could not be updated." };

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
  } catch {
    return { status: "error", message: "Password could not be updated." };
  }
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
