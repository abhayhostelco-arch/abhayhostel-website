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
}: {
  selectedDate: string;
  entry?: DailyEntry;
  minDate: string;
  maxDate: string;
}) {
  const [state, action, pending] = useActionState(
    saveDailyEntryAction,
    initialActionState,
  );
  const hours = entry ? Math.floor(entry.study_minutes / 60) : 0;
  const minutes = entry ? entry.study_minutes % 60 : 0;

  return (
    <form action={action} className="split-form">
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
      <div className="field">
        <label htmlFor="academyStatus">Academy attendance</label>
        <select
          id="academyStatus"
          name="academyStatus"
          defaultValue={entry?.academy_status ?? "present"}
        >
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="no_class">No class</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="sleepTime">Previous night sleep time</label>
        <input
          id="sleepTime"
          name="sleepTime"
          type="time"
          defaultValue={entry?.sleep_time.slice(0, 5) ?? "22:30"}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="wakeTime">Wake-up time</label>
        <input
          id="wakeTime"
          name="wakeTime"
          type="time"
          defaultValue={entry?.wake_time.slice(0, 5) ?? "06:00"}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="studyHours">Study hours</label>
        <input
          id="studyHours"
          name="studyHours"
          type="number"
          min={0}
          max={18}
          defaultValue={hours}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="studyMinutes">Additional minutes</label>
        <input
          id="studyMinutes"
          name="studyMinutes"
          type="number"
          min={0}
          max={59}
          defaultValue={minutes}
          required
        />
      </div>
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
