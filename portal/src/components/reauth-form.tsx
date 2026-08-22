"use client";

import { useActionState } from "react";
import { reauthenticateAction } from "@/app/actions/accounts";
import { initialActionState } from "@/lib/types";

export function ReauthForm() {
  const [state, action, pending] = useActionState(reauthenticateAction, initialActionState);
  return (
    <form action={action} className="form-stack">
      <div className="field">
        <label htmlFor="reauthPassword">Confirm your current password</label>
        <input
          id="reauthPassword"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
        />
      </div>
      {state.message ? (
        <p className={`form-message ${state.status === "success" ? "form-success" : "form-error"}`}>
          {state.message}
        </p>
      ) : null}
      <button className="button button-secondary" type="submit" disabled={pending}>
        {pending ? "Verifying…" : "Unlock sensitive actions"}
      </button>
    </form>
  );
}
