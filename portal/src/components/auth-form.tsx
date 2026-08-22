"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { initialActionState } from "@/lib/types";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialActionState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="auth-card">
      <h2>Welcome back</h2>
      <p>Sign in with the credentials issued by the hostel administration.</p>
      <form action={action} className="form-stack">
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-input">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={128}
              required
            />
            <button
              className="password-visibility-button"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
          <p className="field-hint">Password must contain at least 14 characters.</p>
        </div>
        <TurnstileWidget />
        {state.status === "error" && state.message ? (
          <p className="form-message form-error" role="alert">
            {state.message}
          </p>
        ) : null}
        <button className="button" type="submit" disabled={pending}>
          <LockKeyhole size={18} aria-hidden="true" />
          {pending ? "Signing in…" : "Sign in securely"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="https://abhayhostel.in">Back to website</Link>
        <Link href="/forgot-password">Forgot password?</Link>
      </div>
      <p className="security-note">
        <ShieldCheck size={18} aria-hidden="true" />
        Protected by encrypted sessions, bot checks, and role-based access.
      </p>
    </div>
  );
}
