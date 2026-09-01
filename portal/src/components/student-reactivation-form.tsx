"use client";

import { useActionState } from "react";
import { reactivateStudentAction } from "@/app/actions/accounts";
import { studentGroupLabel, studentGroupOptions } from "@/lib/student-groups";
import { initialActionState, type StudentGroup } from "@/lib/types";

export function StudentReactivationForm({
  studentId,
  studentName,
  studentGroup,
  canChangeGroup = true,
}: {
  studentId: string;
  studentName: string;
  studentGroup: StudentGroup;
  canChangeGroup?: boolean;
}) {
  const [state, action, pending] = useActionState(reactivateStudentAction, initialActionState);
  return <div>
    <form action={action} className="inline-assignment">
      <input type="hidden" name="targetId" value={studentId} />
      {canChangeGroup ? <><label className="visually-hidden" htmlFor={`reactivateGroup-${studentId}`}>Group for {studentName}</label><select id={`reactivateGroup-${studentId}`} name="studentGroup" defaultValue={studentGroup} required>
        {studentGroupOptions.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
      </select></> : <><input type="hidden" name="studentGroup" value={studentGroup} /><span className="field-hint">{studentGroupLabel(studentGroup)}</span></>}
      <button className="button button-small button-secondary" type="submit" disabled={pending}>{pending ? "Reactivating…" : "Reactivate"}</button>
    </form>
    {state.message ? <p className={state.status === "success" ? "form-success" : "form-error"} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
  </div>;
}
