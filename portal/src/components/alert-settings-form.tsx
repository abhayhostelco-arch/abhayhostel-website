"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateAlertSettingsAction } from "@/app/actions/settings";
import type { AlertSettings } from "@/lib/types";
import { initialActionState } from "@/lib/types";

export function AlertSettingsForm({ settings }: { settings: AlertSettings }) {
  const [state, action, pending] = useActionState(
    updateAlertSettingsAction,
    initialActionState,
  );
  return (
    <form action={action} className="split-form">
      <label className="checkbox-row full-span"><input name="missedEntryEnabled" type="checkbox" defaultChecked={settings.missed_entry_enabled} /> Alert when a completed day has no entry</label>
      <label className="checkbox-row full-span"><input name="sleepAlertEnabled" type="checkbox" defaultChecked={settings.sleep_alert_enabled} /> Alert on sleep duration outside limits</label>
      <div className="field"><label htmlFor="minSleepMinutes">Minimum sleep (minutes)</label><input id="minSleepMinutes" name="minSleepMinutes" type="number" min={60} max={900} defaultValue={settings.min_sleep_minutes} required /></div>
      <div className="field"><label htmlFor="maxSleepMinutes">Maximum sleep (minutes)</label><input id="maxSleepMinutes" name="maxSleepMinutes" type="number" min={120} max={960} defaultValue={settings.max_sleep_minutes} required /></div>
      <label className="checkbox-row full-span"><input name="studyAlertEnabled" type="checkbox" defaultChecked={settings.study_alert_enabled} /> Alert when study duration is below target</label>
      <div className="field"><label htmlFor="minStudyMinutes">Minimum study (minutes)</label><input id="minStudyMinutes" name="minStudyMinutes" type="number" min={0} max={1080} defaultValue={settings.min_study_minutes} required /></div>
      <label className="checkbox-row full-span"><input name="absenceAlertEnabled" type="checkbox" defaultChecked={settings.absence_alert_enabled} /> Alert on Gita class absence</label>
      {state.message ? <p className={`form-message full-span ${state.status === "success" ? "form-success" : "form-error"}`}>{state.message}</p> : null}
      {state.fieldErrors?.minSleepMinutes?.map((message) => <p key={message} className="form-message form-error full-span">{message}</p>)}
      <div className="full-span form-submit-bar"><button className="button" type="submit" disabled={pending}><Save size={18} aria-hidden="true" /> {pending ? "Saving…" : "Save Alert Settings"}</button></div>
    </form>
  );
}
