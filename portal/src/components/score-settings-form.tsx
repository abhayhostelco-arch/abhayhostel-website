"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateScoreSettingsAction } from "@/app/actions/settings";
import type { ScoreSettings } from "@/lib/types";
import { initialActionState } from "@/lib/types";

export function ScoreSettingsForm({ settings }: { settings: ScoreSettings }) {
  const [state, action, pending] = useActionState(updateScoreSettingsAction, initialActionState);
  const fields = [
    ["sadhanaWeight", "Sadhana weight (%)", settings.sadhana_weight, 0, 100],
    ["studyWeight", "Study weight (%)", settings.study_weight, 0, 100],
    ["disciplineWeight", "Discipline weight (%)", settings.discipline_weight, 0, 100],
    ["sevaWeight", "Seva & Character weight (%)", settings.seva_weight, 0, 100],
    ["chantingTargetRounds", "Chanting target (rounds)", settings.chanting_target_rounds, 1, 108],
    ["eveningReadingTargetMinutes", "Evening reading target (minutes)", settings.evening_reading_target_minutes, 1, 360],
    ["studyTargetMinutes", "Study target (minutes)", settings.study_target_minutes, 1, 1080],
    ["sevaTargetMinutes", "Seva target (minutes)", settings.seva_target_minutes, 1, 720],
    ["disciplineGraceMinutes", "Discipline grace period (minutes)", settings.discipline_grace_minutes, 1, 360],
  ] as const;
  return (
    <form action={action} className="split-form">
      {fields.map(([name, label, value, min, max]) => (
        <div className="field" key={name}>
          <label htmlFor={name}>{label}</label>
          <input id={name} name={name} type="number" min={min} max={max} defaultValue={value} required />
          {state.fieldErrors?.[name]?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}
        </div>
      ))}
      <div className="field"><label htmlFor="wakeTargetTime">Wake-up target</label><input id="wakeTargetTime" name="wakeTargetTime" type="time" defaultValue={settings.wake_target_time.slice(0, 5)} required /></div>
      <div className="field"><label htmlFor="bedtimeTargetTime">Bedtime target</label><input id="bedtimeTargetTime" name="bedtimeTargetTime" type="time" defaultValue={settings.bedtime_target_time.slice(0, 5)} required /></div>
      <div className="field"><label htmlFor="scoreStartDate">Scoring launch date</label><input id="scoreStartDate" name="scoreStartDate" type="date" defaultValue={settings.score_start_date} required /></div>
      <p className="field-hint full-span">Category weights must total 100. Changing these settings recalculates reports from the launch date.</p>
      {state.message ? <p className={`form-message full-span ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
      <div className="full-span form-submit-bar"><button className="button" type="submit" disabled={pending}><Save size={18} aria-hidden="true" />{pending ? "Saving…" : "Save Growth Score Settings"}</button></div>
    </form>
  );
}
