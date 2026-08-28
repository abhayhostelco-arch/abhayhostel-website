"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { initialActionState } from "@/lib/types";
import { useActionAnalytics } from "@/hooks/use-action-analytics";

type ForgotPasswordFormProps = {
  invalidRecoveryLink?: boolean;
};

export function ForgotPasswordForm({ invalidRecoveryLink }: ForgotPasswordFormProps) {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialActionState,
  );
  const [captchaReady, setCaptchaReady] = useState(false);
  const handleCaptchaReady = useCallback((ready: boolean) => setCaptchaReady(ready), []);
  useActionAnalytics(state);

  return (
    <div className="auth-card">
      <h2>Reset password</h2>
      <p>Enter your account email. The response will not reveal account status.</p>
      {invalidRecoveryLink ? (
        <p className="form-message form-error" role="alert">
          This password-reset link is invalid or has expired. Request a new one below.
        </p>
      ) : null}
      <form action={action} className="form-stack">
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" maxLength={254} autoComplete="email" spellCheck={false} required />
        </div>
        <TurnstileWidget
          onReadyChange={handleCaptchaReady}
          resetSignal={state.status !== "idle" ? state : undefined}
        />
        {state.message ? (
          <p
            className={`form-message ${state.status === "error" ? "form-error" : "form-success"}`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        ) : null}
        <button className="button" type="submit" disabled={pending || !captchaReady}>
          {pending ? "Requesting…" : "Send reset instructions"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/login">Return to sign in</Link>
      </div>
    </div>
  );
}
