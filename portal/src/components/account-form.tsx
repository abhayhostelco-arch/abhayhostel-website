"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createAccountAction } from "@/app/actions/accounts";
import { initialActionState } from "@/lib/types";

export function AccountForm({ role }: { role: "admin" | "student" }) {
  const [state, action, pending] = useActionState(createAccountAction, initialActionState);
  return (
    <form action={action} className="split-form">
      <input type="hidden" name="role" value={role} />
      <div className="field">
        <label htmlFor={`${role}-fullName`}>Full name</label>
        <input id={`${role}-fullName`} name="fullName" minLength={2} maxLength={120} required />
      </div>
      <div className="field">
        <label htmlFor={`${role}-email`}>Email</label>
        <input id={`${role}-email`} name="email" type="email" maxLength={254} required />
      </div>
      {role === "student" ? (
        <>
          <div className="field">
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" name="phone" type="tel" maxLength={30} />
          </div>
          <div className="field">
            <label htmlFor="academyLabel">Academy / class</label>
            <input id="academyLabel" name="academyLabel" maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="joinedOn">Hostel join date</label>
            <input id="joinedOn" name="joinedOn" type="date" required />
          </div>
        </>
      ) : null}
      {state.message ? (
        <p
          className={`form-message full-span ${
            state.status === "success" ? "form-success" : "form-error"
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      {state.temporaryPassword ? (
        <p className="temporary-password full-span">
          Temporary password: <strong>{state.temporaryPassword}</strong>
        </p>
      ) : null}
      <div className="full-span">
        <button className="button" type="submit" disabled={pending}>
          <UserPlus size={18} aria-hidden="true" />
          {pending ? "Creating…" : `Create ${role} account`}
        </button>
      </div>
    </form>
  );
}
