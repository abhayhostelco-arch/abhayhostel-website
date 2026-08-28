"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { saveDailyEntryAction } from "@/app/actions/daily-entry";
import type { DailyEntry } from "@/lib/types";
import { initialActionState } from "@/lib/types";
import { displayDate } from "@/lib/date";

export function DailyEntryForm({
  selectedDate,
  entry,
  minDate,
  maxDate,
  studentId,
}: {
  selectedDate: string;
  entry?: DailyEntry;
  minDate: string;
  maxDate: string;
  studentId?: string;
}) {
  const [state, action, pending] = useActionState(
    saveDailyEntryAction,
    initialActionState,
  );
  const successDialogRef = useRef<HTMLDialogElement>(null);
  const [dirty, setDirty] = useState(false);
  const hours = entry ? Math.floor(entry.study_minutes / 60) : 0;
  const minutes = entry ? entry.study_minutes % 60 : 0;

  useEffect(() => {
    if (state.status === "success" && !successDialogRef.current?.open) {
      setDirty(false);
      successDialogRef.current?.showModal();
    }
  }, [state]);

  useEffect(() => {
    if (!dirty || pending) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, pending]);

  return (
    <>
      <form action={action} className="split-form" onChange={() => setDirty(true)}>
      {studentId ? <input type="hidden" name="studentId" value={studentId} /> : null}
      <div className="field">
        <label htmlFor="entryDate">Wake-up date</label>
        <input
          id="entryDate"
          name="entryDate"
          type="date"
          min={minDate}
          max={maxDate}
          defaultValue={selectedDate}
          required
        />
      </div>
      <fieldset className="routine-section full-span">
        <legend>Sadhana</legend>
        <div className="split-form">
          <div className="field">
            <label htmlFor="chantingRounds">Morning meditation (chanting rounds)</label>
            <input id="chantingRounds" name="chantingRounds" type="number" min={0} max={108} step={1} defaultValue={entry ? entry.chanting_rounds ?? "" : 0} required />
            {state.fieldErrors?.chantingRounds?.[0] ? <p className="field-error" role="alert">Enter a whole number from 0 to 108.</p> : null}
          </div>
          <div className="field">
            <label htmlFor="gitaClassStatus">Gita class attendance</label>
            <select id="gitaClassStatus" name="gitaClassStatus" defaultValue={entry?.gita_class_status ?? "present"}>
              <option value="present">Present</option><option value="absent">Absent</option><option value="no_class">No class</option>
            </select>
          </div>
          <label className="checkbox-row"><input name="morningAratiAttended" type="checkbox" defaultChecked={entry?.morning_arati_attended ?? false} /> Attended Morning Arati</label>
          <div className="field"><label htmlFor="eveningReadingMinutes">Evening book reading (minutes)</label><input id="eveningReadingMinutes" name="eveningReadingMinutes" type="number" min={0} max={360} defaultValue={entry?.evening_reading_minutes ?? 0} required /></div>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Study</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="studyHours">Study hours</label><input id="studyHours" name="studyHours" type="number" min={0} max={18} defaultValue={hours} required /></div>
          <div className="field"><label htmlFor="studyMinutes">Additional minutes</label><input id="studyMinutes" name="studyMinutes" type="number" min={0} max={59} defaultValue={minutes} required /></div>
          <label className="checkbox-row full-span"><input name="libraryAttended" type="checkbox" defaultChecked={entry?.library_attended ?? false} /> Attended Class</label>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Discipline</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="sleepTime">Previous night sleep time</label><input id="sleepTime" name="sleepTime" type="time" defaultValue={entry?.sleep_time.slice(0, 5) ?? "22:30"} required /></div>
          <div className="field"><label htmlFor="wakeTime">Wake-up time</label><input id="wakeTime" name="wakeTime" type="time" defaultValue={entry?.wake_time.slice(0, 5) ?? "06:00"} required /></div>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Seva &amp; Character</legend>
        <div className="field"><label htmlFor="sevaMinutes">Seva (minutes)</label><input id="sevaMinutes" name="sevaMinutes" type="number" min={0} max={720} defaultValue={entry?.seva_minutes ?? 0} required /></div>
        <p className="field-hint">This category is calculated from self-reported seva minutes, not a subjective character assessment.</p>
      </fieldset>
      <div className="field full-span">
        <label htmlFor="note">Optional note</label>
        <textarea
          id="note"
          name="note"
          maxLength={500}
          defaultValue={entry?.note ?? ""}
          placeholder="Add anything the administration should know…"
        />
      </div>
      {state.message && state.status !== "success" ? (
        <p
          className="form-message form-error full-span"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <div className="full-span form-submit-bar">
        <button className="button" type="submit" disabled={pending}>
          <Save size={18} aria-hidden="true" />
          {pending ? "Saving…" : entry ? "Update Daily Entry" : "Save Daily Entry"}
        </button>
      </div>
      </form>
      <dialog
        ref={successDialogRef}
        className="save-success-dialog"
        aria-labelledby="save-success-title"
        aria-describedby="save-success-description"
      >
        <div className="save-success-icon" aria-hidden="true">
          <CheckCircle2 size={34} strokeWidth={1.8} />
        </div>
        <p className="eyebrow">Entry complete</p>
        <h2 id="save-success-title">Daily entry saved</h2>
        <p id="save-success-description">
          Your routine for {displayDate(selectedDate)} has been recorded successfully.
        </p>
        <button
          className="button save-success-action"
          type="button"
          onClick={() => successDialogRef.current?.close()}
        >
          Done
        </button>
      </dialog>
    </>
  );
}
