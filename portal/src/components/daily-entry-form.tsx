"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { saveDailyEntryAction } from "@/app/actions/daily-entry";
import type { DailyEntry } from "@/lib/types";
import { initialActionState } from "@/lib/types";

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
  const hours = entry ? Math.floor(entry.study_minutes / 60) : 0;
  const minutes = entry ? entry.study_minutes % 60 : 0;

  return (
    <form action={action} className="split-form">
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
        <legend>🕉️ Sadhana</legend>
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
        <legend>📚 Study</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="studyHours">Study hours</label><input id="studyHours" name="studyHours" type="number" min={0} max={18} defaultValue={hours} required /></div>
          <div className="field"><label htmlFor="studyMinutes">Additional minutes</label><input id="studyMinutes" name="studyMinutes" type="number" min={0} max={59} defaultValue={minutes} required /></div>
          <label className="checkbox-row full-span"><input name="libraryAttended" type="checkbox" defaultChecked={entry?.library_attended ?? false} /> Attended the library</label>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>🛏️ Discipline</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="sleepTime">Previous night sleep time</label><input id="sleepTime" name="sleepTime" type="time" defaultValue={entry?.sleep_time.slice(0, 5) ?? "22:30"} required /></div>
          <div className="field"><label htmlFor="wakeTime">Wake-up time</label><input id="wakeTime" name="wakeTime" type="time" defaultValue={entry?.wake_time.slice(0, 5) ?? "06:00"} required /></div>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>🤝 Seva &amp; Character</legend>
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
          placeholder="Anything the administration should know about this day"
        />
      </div>
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
      <div className="full-span">
        <button className="button" type="submit" disabled={pending}>
          <Save size={18} aria-hidden="true" />
          {pending ? "Saving…" : entry ? "Update daily entry" : "Save daily entry"}
        </button>
      </div>
    </form>
  );
}
