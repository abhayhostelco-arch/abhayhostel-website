"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateScoreSettingsAction } from "@/app/actions/settings";
import type { ScoreSettings } from "@/lib/types";
import { initialActionState } from "@/lib/types";

const rubric = [
  ["Sadhana", "2 rounds", "Gita attendance · Morning Arati · 30 minutes reading · equal applicable components"],
  ["Study", "6 hours per day", "Capped at 100 · no library-attendance bonus"],
  ["Discipline", "10:00 PM / 5:00 AM", "25 points each · minus 5 per started 30-minute late interval"],
  ["Seva", "180 minutes per Monday–Sunday week", "Prorated only for joining, scoring-start, and current incomplete weeks"],
  ["Overall", "25% per category", "Equal category weighting · missing eligible entries score zero"],
] as const;

export function ScoreSettingsForm({ settings }: { settings: ScoreSettings }) {
  const [state, action, pending] = useActionState(updateScoreSettingsAction, initialActionState);
  return (
    <form action={action} className="split-form">
      <div className="full-span">
        <p className="field-hint">The scoring rubric is fixed in server code. Legacy database formula fields remain stored for compatibility but do not change calculated scores.</p>
        <div className="metric-grid section-gap-small" aria-label="Fixed Growth Score rubric">
          {rubric.map(([label, value, detail]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
        </div>
      </div>
      <div className="field"><label htmlFor="scoreStartDate">Scoring launch date</label><input id="scoreStartDate" name="scoreStartDate" type="date" defaultValue={settings.score_start_date} required />{state.fieldErrors?.scoreStartDate?.map((message) => <p className="field-error" key={message} role="alert">{message}</p>)}</div>
      <p className="field-hint full-span">Changing the launch date recalculates eligible historical reports. It does not change the fixed formula.</p>
      {state.message ? <p className={`form-message full-span ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
      <div className="full-span form-submit-bar"><button className="button" type="submit" disabled={pending}><Save size={18} aria-hidden="true" />{pending ? "Saving…" : "Save Scoring Launch Date"}</button></div>
    </form>
  );
}
