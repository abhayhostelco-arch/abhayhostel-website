"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCheck, RotateCcw } from "lucide-react";
import { saveGitaAttendanceAction } from "@/app/actions/gita-attendance";
import { initialActionState, type ActionState, type GitaClassAttendance, type GitaClassStatus, type Profile } from "@/lib/types";

const statuses: Array<{ value: GitaClassStatus; label: string }> = [
  { value: "present", label: "Present" }, { value: "absent", label: "Absent" }, { value: "no_class", label: "No Class" },
];

export function GitaAttendanceForm({
  students,
  records,
  attendanceDate,
  profileBasePath,
}: {
  students: Profile[];
  records: GitaClassAttendance[];
  attendanceDate: string;
  profileBasePath: string;
}) {
  const initialValues = (): Record<string, GitaClassStatus | ""> => Object.fromEntries(
    students.map((student) => [student.id, records.find((record) => record.student_id === student.id)?.status ?? ""]),
  );
  const [values, setValues] = useState<Record<string, GitaClassStatus | "">>(initialValues);
  const [savedValues, setSavedValues] = useState<Record<string, GitaClassStatus | "">>(initialValues);
  const [state, action, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await saveGitaAttendanceAction(previous, formData);
    if (result.status === "success") setSavedValues(values);
    return result;
  }, initialActionState);
  const completed = Object.values(values).filter(Boolean).length;
  const dirtyCount = students.filter((student) => values[student.id] !== savedValues[student.id]).length;
  function markAll(status: GitaClassStatus) {
    setValues(Object.fromEntries(students.map((student) => [student.id, status])));
  }
  function toggleStatus(studentId: string, status: GitaClassStatus) {
    setValues((current) => ({ ...current, [studentId]: current[studentId] === status ? "" : status }));
  }
  return <form action={action}>
    <input type="hidden" name="attendanceDate" value={attendanceDate} />
    <div className="attendance-toolbar">
      <span><strong>{completed}/{students.length}</strong> students marked</span>
      <div className="actions-row" aria-label="Bulk attendance actions">
        <button className="button button-secondary button-small" type="button" onClick={() => markAll("present")}>All Present</button>
        <button className="button button-secondary button-small" type="button" onClick={() => markAll("no_class")}>No Class Today</button>
        <button className="button button-secondary button-small" type="button" disabled={dirtyCount === 0} onClick={() => setValues(savedValues)}><RotateCcw size={14} aria-hidden="true" /> Reset All</button>
      </div>
    </div>
    <div className="attendance-sheet">
      {students.map((student, index) => <fieldset key={student.id} className="attendance-student-row">
        <legend><span>{index + 1}</span><Link className="attendance-student-link" href={`${profileBasePath}/${student.id}`}><strong>{student.full_name}</strong><small>{student.academy_label ?? "Student"}</small></Link></legend>
        <div className="attendance-options">
          {statuses.map((status) => <label key={status.value} className={`attendance-option attendance-${status.value}`}>
            <input type="radio" name={`status:${student.id}`} value={status.value} checked={values[student.id] === status.value} onClick={() => toggleStatus(student.id, status.value)} readOnly />
            <span>{status.label}</span>
          </label>)}
        </div>
      </fieldset>)}
    </div>
    {state.message ? <p className={`form-message ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    <div className="attendance-save-bar"><span>{dirtyCount > 0 ? `${dirtyCount} ${dirtyCount === 1 ? "change" : "changes"} ready to save.` : state.status === "success" ? "All changes saved." : "No unsaved changes."}</span><button className="button" type="submit" disabled={pending || dirtyCount === 0 || completed === 0}><CheckCheck size={18} aria-hidden="true" /> {pending ? "Saving…" : "Save Attendance"}</button></div>
  </form>;
}
