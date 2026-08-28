"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { saveWeeklyEntryAction } from "@/app/actions/workflows";
import { initialActionState, type ActionState } from "@/lib/types";

type Attendance = "present" | "absent";

export function WeeklyEntryForm({
  programId,
  initialAttendance,
  initialWoreDhotiKurta,
}: {
  programId: string;
  initialAttendance: Attendance | null;
  initialWoreDhotiKurta: boolean | null;
}) {
  const [attendance, setAttendance] = useState<Attendance>(initialAttendance ?? "present");
  const [woreDhotiKurta, setWoreDhotiKurta] = useState(initialWoreDhotiKurta ?? true);
  const [savedValues, setSavedValues] = useState({ attendance: initialAttendance, woreDhotiKurta: initialWoreDhotiKurta });
  const [state, action, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await saveWeeklyEntryAction(previous, formData);
    if (result.status === "success") setSavedValues({ attendance, woreDhotiKurta });
    return result;
  }, initialActionState);
  const dirty = attendance !== savedValues.attendance || woreDhotiKurta !== savedValues.woreDhotiKurta;

  const saved = !dirty && (state.status === "success" || initialAttendance !== null);
  return <form action={action} className="form-stack">
    <input type="hidden" name="programId" value={programId} />
    <fieldset className="choice-field"><legend>Weekly Program attendance</legend><label><input type="radio" name="attendance" value="present" checked={attendance === "present"} onChange={() => setAttendance("present")} /> Present</label><label><input type="radio" name="attendance" value="absent" checked={attendance === "absent"} onChange={() => setAttendance("absent")} /> Absent</label></fieldset>
    <fieldset className="choice-field"><legend>Were you wearing Dhoti-Kurta?</legend><label><input type="radio" name="woreDhotiKurta" value="true" checked={woreDhotiKurta} onChange={() => setWoreDhotiKurta(true)} /> Yes</label><label><input type="radio" name="woreDhotiKurta" value="false" checked={!woreDhotiKurta} onChange={() => setWoreDhotiKurta(false)} /> No</label></fieldset>
    {state.status === "error" ? <p className="form-message form-error" role="alert">{state.message}</p> : saved ? <p className="form-message form-success" role="status"><CheckCircle2 size={17} aria-hidden="true" /> Weekly report saved.</p> : null}
    <button className="button" disabled={pending || !dirty}>{pending ? "Saving…" : saved ? "Saved" : initialAttendance !== null ? "Update weekly report" : "Submit weekly report"}</button>
  </form>;
}
