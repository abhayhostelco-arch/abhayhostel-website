"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { initialActionState } from "@/lib/types";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialActionState,
  );
  return (
    <div className="auth-card">
      <h2>Choose a secure password</h2>
      <p>Use at least 14 characters with uppercase, lowercase, number, and symbol.</p>
      <form action={action} className="form-stack">
        <div className="field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={14}
            maxLength={128}
            required
          />
          {state.fieldErrors?.password?.map((message) => (
            <p key={message} className="form-message form-error">
              {message}
            </p>
          ))}
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            required
          />
          {state.fieldErrors?.confirmPassword?.map((message) => (
            <p key={message} className="form-message form-error">
              {message}
            </p>
          ))}
        </div>
        {state.message ? (
          <p className="form-message form-error" role="alert">
            {state.message}
          </p>
        ) : null}
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
