"use client";

import { useActionState } from "react";
import { updateStudentGroupAction } from "@/app/actions/accounts";
import { studentGroupOptions } from "@/lib/student-groups";
import { initialActionState, type StudentGroup } from "@/lib/types";

export function StudentGroupForm({ studentId, studentGroup }: { studentId: string; studentGroup: StudentGroup }) {
  const [state, action, pending] = useActionState(updateStudentGroupAction, initialActionState);
  return <form action={action} className="student-birthdate-form">
    <input type="hidden" name="targetId" value={studentId} />
    <div className="field">
      <label htmlFor={`studentGroup-${studentId}`}>Student group</label>
      <select id={`studentGroup-${studentId}`} name="studentGroup" defaultValue={studentGroup} required>
        {studentGroupOptions.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
      </select>
    </div>
    <button className="button button-small" type="submit" disabled={pending}>{pending ? "Saving…" : "Save Group"}</button>
    {state.message ? <p className={`student-profile-form-message ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
