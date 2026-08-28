"use client";

import { useActionState, useState } from "react";
import { updateStudentBirthDateAction } from "@/app/actions/accounts";
import { initialActionState, type ActionState } from "@/lib/types";

export function StudentBirthDateForm({
  studentId,
  birthDate,
  displayBirthDate,
  maxDate,
}: {
  studentId: string;
  birthDate: string | null;
  displayBirthDate: string | null;
  maxDate: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (previousState: ActionState, formData: FormData) => {
    const result = await updateStudentBirthDateAction(previousState, formData);
    if (result.status === "success") setEditing(false);
    return result;
  }, initialActionState);

  if (!editing) return <div className="student-birthdate-summary"><span><small>Birthdate</small><strong>{displayBirthDate ?? "Not provided"}</strong></span><button className="button button-secondary button-small" type="button" aria-expanded="false" onClick={() => setEditing(true)}>{birthDate ? "Edit" : "Add Birthdate"}</button></div>;

  return <form action={action} className="student-birthdate-form">
    <input type="hidden" name="targetId" value={studentId} />
    <div className="field">
      <label htmlFor="studentBirthDate">Birthdate</label>
      <input id="studentBirthDate" name="birthDate" type="date" defaultValue={birthDate ?? ""} max={maxDate} />
    </div>
    <div className="student-birthdate-actions"><button className="button button-small" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button><button className="button button-secondary button-small" type="button" disabled={pending} onClick={() => setEditing(false)}>Cancel</button></div>
    {state.message ? <p className={`student-profile-form-message ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
