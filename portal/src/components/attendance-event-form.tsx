"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createAttendanceEventAction } from "@/app/actions/workflows";
import { initialActionState } from "@/lib/types";

export function AttendanceEventForm() {
  const [state, action, pending] = useActionState(createAttendanceEventAction, initialActionState);
  return <form action={action} className="form-stack">
    <div className="field"><label htmlFor="event-name">Event Name</label><input id="event-name" name="name" required maxLength={120} autoComplete="off" /></div>
    <div className="field"><label htmlFor="statuses">Statuses</label><input id="statuses" name="statuses" defaultValue="Present, Absent, Late" required autoComplete="off" /><p className="field-hint">Separate up to 8 options with commas.</p></div>
    {state.status === "error" ? <p className="form-message form-error" role="alert">{state.message}</p> : null}
    <div className="form-actions"><Link className="button button-secondary" href="/attendance">Cancel</Link><button className="button" disabled={pending}>{pending ? "Creating…" : "Create Event"}</button></div>
  </form>;
}
