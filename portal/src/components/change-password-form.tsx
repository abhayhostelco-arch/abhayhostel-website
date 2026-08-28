"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";
import { initialActionState } from "@/lib/types";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialActionState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  return (
    <div className="auth-card">
      <h2>Choose a secure password</h2>
      <p>Use at least 14 characters with uppercase, lowercase, number, and symbol.</p>
      <form action={action} className="form-stack">
        <div className="field">
          <label htmlFor="password">New password</label>
          <div className="password-input"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={14} maxLength={128} aria-invalid={Boolean(state.fieldErrors?.password?.length)} required /><button className="password-visibility-button" type="button" aria-label={showPassword ? "Hide new password" : "Show new password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></div>
          {state.fieldErrors?.password?.map((message) => (
            <p key={message} className="form-message form-error" role="alert">
              {message}
            </p>
          ))}
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <div className="password-input"><input id="confirmPassword" name="confirmPassword" type={showConfirmation ? "text" : "password"} autoComplete="new-password" maxLength={128} aria-invalid={Boolean(state.fieldErrors?.confirmPassword?.length)} required /><button className="password-visibility-button" type="button" aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation((visible) => !visible)}>{showConfirmation ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></div>
          {state.fieldErrors?.confirmPassword?.map((message) => (
            <p key={message} className="form-message form-error" role="alert">
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
