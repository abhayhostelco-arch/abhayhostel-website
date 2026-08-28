"use client";

import { useActionState, useState } from "react";
import { CheckCheck } from "lucide-react";
import { saveGitaAttendanceAction } from "@/app/actions/gita-attendance";
import { initialActionState, type GitaClassAttendance, type GitaClassStatus, type Profile } from "@/lib/types";

const statuses: Array<{ value: GitaClassStatus; label: string }> = [
  { value: "present", label: "Present" }, { value: "absent", label: "Absent" }, { value: "no_class", label: "No Class" },
];

export function GitaAttendanceForm({
  students,
  records,
  attendanceDate,
}: {
  students: Profile[];
  records: GitaClassAttendance[];
  attendanceDate: string;
}) {
  const [state, action, pending] = useActionState(saveGitaAttendanceAction, initialActionState);
  const [values, setValues] = useState<Record<string, GitaClassStatus | "">>(() => Object.fromEntries(
    students.map((student) => [student.id, records.find((record) => record.student_id === student.id)?.status ?? ""]),
  ));
  const completed = Object.values(values).filter(Boolean).length;
  function markAll(status: GitaClassStatus) {
    setValues(Object.fromEntries(students.map((student) => [student.id, status])));
  }
  return <form action={action}>
    <input type="hidden" name="attendanceDate" value={attendanceDate} />
    <div className="attendance-toolbar">
      <span><strong>{completed}/{students.length}</strong> students marked</span>
      <div className="actions-row" aria-label="Bulk attendance actions">
        <button className="button button-secondary button-small" type="button" onClick={() => markAll("present")}>All Present</button>
        <button className="button button-secondary button-small" type="button" onClick={() => markAll("no_class")}>No Class Today</button>
      </div>
    </div>
    <div className="attendance-sheet">
      {students.map((student, index) => <fieldset key={student.id} className="attendance-student-row">
        <legend><span>{index + 1}</span><strong>{student.full_name}</strong><small>{student.academy_label ?? "Student"}</small></legend>
        <div className="attendance-options">
          {statuses.map((status) => <label key={status.value} className={`attendance-option attendance-${status.value}`}>
            <input required type="radio" name={`status:${student.id}`} value={status.value} checked={values[student.id] === status.value} onChange={() => setValues((current) => ({ ...current, [student.id]: status.value }))} />
            <span>{status.label}</span>
          </label>)}
        </div>
      </fieldset>)}
    </div>
    {state.message ? <p className={`form-message ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    <div className="attendance-save-bar"><span>{completed === students.length ? "Sheet complete and ready to save." : "Every student must have one status."}</span><button className="button" type="submit" disabled={pending || completed !== students.length}><CheckCheck size={18} aria-hidden="true" /> {pending ? "Saving…" : "Save Complete Sheet"}</button></div>
  </form>;
}
