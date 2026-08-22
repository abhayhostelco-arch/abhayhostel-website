"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { initialActionState } from "@/lib/types";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialActionState,
  );

  return (
    <div className="auth-card">
      <h2>Reset password</h2>
      <p>Enter your account email. The response will not reveal account status.</p>
      <form action={action} className="form-stack">
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" maxLength={254} required />
        </div>
        <TurnstileWidget />
        {state.message ? (
          <p
            className={`form-message ${state.status === "error" ? "form-error" : "form-success"}`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        ) : null}
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Requesting…" : "Send reset instructions"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/login">Return to sign in</Link>
      </div>
    </div>
  );
}
