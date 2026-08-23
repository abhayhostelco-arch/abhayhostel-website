"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createAccountAction } from "@/app/actions/accounts";
import { initialActionState } from "@/lib/types";
import type { Profile } from "@/lib/types";
import { CopyableTemporaryPassword } from "@/components/copyable-temporary-password";

export function AccountForm({ role, mentors = [] }: { role: "admin" | "student"; mentors?: Profile[] }) {
  const [state, action, pending] = useActionState(createAccountAction, initialActionState);
  return (
    <form action={action} className="split-form">
      <input type="hidden" name="role" value={role} />
      <div className="field">
        <label htmlFor={`${role}-fullName`}>Full name</label>
        <input id={`${role}-fullName`} name="fullName" minLength={2} maxLength={120} autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor={`${role}-email`}>Email</label>
        <input id={`${role}-email`} name="email" type="email" maxLength={254} autoComplete="email" spellCheck={false} required />
      </div>
      {role === "student" ? (
        <>
          <div className="field">
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" name="phone" type="tel" maxLength={30} autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="mentorId">Assigned Mentor</label>
            <select id="mentorId" name="mentorId" required defaultValue="">
              <option value="" disabled>Choose a Mentor</option>
              {mentors.filter((mentor) => mentor.is_active).map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="academyLabel">Academy / class</label>
            <input id="academyLabel" name="academyLabel" maxLength={120} autoComplete="off" />
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
        <CopyableTemporaryPassword
          key={state.temporaryPassword}
          password={state.temporaryPassword}
          className="full-span"
        />
      ) : null}
      <div className="full-span">
        <button className="button" type="submit" disabled={pending}>
          <UserPlus size={18} aria-hidden="true" />
          {pending ? "Creating…" : `Create ${role === "admin" ? "Mentor" : "Student"} Account`}
        </button>
      </div>
    </form>
  );
}
