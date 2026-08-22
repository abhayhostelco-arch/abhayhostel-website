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
import { homeForRole } from "@/lib/roles";

const genericLoginError = "The email or password is incorrect.";
const captchaLoginError = "Security verification expired or was already used. Complete the refreshed check and try again.";

function loginFailure(
  reason: string,
  message: string,
  outcome: "failure" | "blocked" = "failure",
): ActionState {
  return {
    status: "error",
    message,
    analytics: {
      name: "auth_login",
      params: { outcome, reason, verification_reset_required: true },
    },
  };
}

function passwordResetResult(
  status: "success" | "error",
  message: string,
  outcome: "success" | "failure" | "blocked",
  reason: string,
): ActionState {
  return {
    status,
    message,
    analytics: {
      name: "auth_password_reset",
      params: { outcome, reason, verification_reset_required: true },
    },
  };
}

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
    const captchaToken = formData.get("captchaToken");
    return typeof captchaToken !== "string" || !captchaToken
      ? loginFailure("verification_missing", "Complete the security verification before signing in.", "blocked")
      : loginFailure("invalid_input", genericLoginError);
  }

  let destination: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      options: parsed.data.captchaToken
        ? { captchaToken: parsed.data.captchaToken }
        : undefined,
    });
    if (error || !data.user) {
      if (error?.code === "captcha_failed") {
        return loginFailure("verification_expired", captchaLoginError, "blocked");
      }
      if (error?.code === "over_request_rate_limit" || error?.status === 429) {
        return loginFailure("rate_limited", "Too many sign-in attempts. Wait a few minutes, then complete a new security check and try again.", "blocked");
      }
      return loginFailure("invalid_credentials", genericLoginError);
    }

    const { data: profile, error: profileError } = await createAdminClient()
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return loginFailure("profile_unavailable", "Your login was accepted, but the portal profile could not be loaded. Try again shortly.");
    }
    if (!profile.is_active) {
      await supabase.auth.signOut();
      return loginFailure("account_inactive", "This account is inactive. Ask an Admin or assigned Mentor to reactivate it.", "blocked");
    }

    const typedProfile = profile as Profile;
    destination = typedProfile.must_change_password
      ? "/change-password"
      : homeForRole(typedProfile.role);
  } catch {
    return loginFailure("service_unavailable", "The sign-in service is temporarily unavailable. Try again shortly.");
  }
  redirect(destination);
}

export async function forgotPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const captchaToken = formData.get("captchaToken");
  const captchaError =
    "Security verification failed. Refresh the page and try again.";
  if (
    typeof captchaToken !== "string" ||
    captchaToken.length === 0 ||
    captchaToken.length > 4096
  ) {
    return passwordResetResult("error", captchaError, "blocked", "verification_missing");
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
    captchaToken,
  });
  const message =
    "If that email belongs to an active account, password-reset instructions will be sent.";
  if (!parsed.success) return passwordResetResult("success", message, "failure", "invalid_input");

  try {
    const env = getServerEnv();
    const { data: activeProfile } = await createAdminClient()
      .from("profiles")
      .select("id")
      .eq("email", parsed.data.email)
      .eq("is_active", true)
      .maybeSingle();
    if (!activeProfile) return passwordResetResult("success", message, "success", "request_accepted");
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      captchaToken: parsed.data.captchaToken,
    });
    if (error?.code === "captcha_failed") {
      return passwordResetResult("error", captchaError, "blocked", "verification_expired");
    }
  } catch {
    // Deliberately return the same response to prevent account enumeration.
  }
  return passwordResetResult("success", message, "success", "request_accepted");
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
