"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createWeeklyProgramAction } from "@/app/actions/workflows";
import { initialActionState } from "@/lib/types";

export function WeeklyProgramForm({ minDate }: { minDate: string }) {
  const [state, action, pending] = useActionState(createWeeklyProgramAction, initialActionState);

  return <form action={action} className="form-stack">
    <div className="field"><label htmlFor="programDate">Program Date</label><input id="programDate" name="programDate" type="date" min={minDate} required /></div>
    {state.message ? <p className="form-message form-error" role="alert">{state.message}</p> : null}
    <div className="form-actions"><Link className="button button-secondary" href="/weekly-program">Cancel</Link><button className="button" type="submit" disabled={pending}>{pending ? "Opening…" : "Open Session"}</button></div>
  </form>;
}
