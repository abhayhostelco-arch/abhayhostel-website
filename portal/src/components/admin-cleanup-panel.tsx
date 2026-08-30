"use client";

import { useActionState } from "react";
import { AlertTriangle, Database, Play, RotateCcw, Save } from "lucide-react";
import { confirmCleanupPreviewAction, previewHistoricalCleanupAction, resumeCleanupRunAction, updateAutoCleanupAction } from "@/app/actions/cleanup";
import type { CleanupRunView, CleanupSettingsView } from "@/lib/cleanup/types";
import { initialActionState } from "@/lib/types";

function Message({ state }: { state: typeof initialActionState }) {
  return state.message ? <p className={`form-message ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null;
}

export function AdminCleanupPanel({ available, settings, runs }: { available: boolean; settings: CleanupSettingsView | null; runs: CleanupRunView[] }) {
  const [toggleState, toggleAction, togglePending] = useActionState(updateAutoCleanupAction, initialActionState);
  const [previewState, previewAction, previewPending] = useActionState(previewHistoricalCleanupAction, initialActionState);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmCleanupPreviewAction, initialActionState);
  if (!available || !settings) return <section className="panel cleanup-panel section-gap"><div className="panel-title"><h2>Data Maintenance</h2></div><p className="form-message form-error">The maintenance migration has not been applied. Existing profile settings remain available.</p></section>;

  const preview = runs.find((run) => run.mode === "manual" && run.status === "previewed");
  const previewRowCounts = preview?.previewImpact?.rowCounts as Record<string, unknown> | undefined;
  const previewRecordCount = Object.values(previewRowCounts ?? {}).reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0);
  const previewObjectCount = typeof preview?.previewImpact?.objectCount === "number" ? preview.previewImpact.objectCount : 0;
  return <section className="panel cleanup-panel section-gap" aria-labelledby="cleanup-title">
    <div className="panel-title"><div><p className="eyebrow">Storage &amp; retention</p><h2 id="cleanup-title"><Database size={18} aria-hidden="true" /> Data Maintenance</h2></div></div>
    <div className="cleanup-warning"><AlertTriangle size={18} aria-hidden="true" /><p>Cleanup permanently deletes eligible historical records and files. Deleted data cannot be restored.</p></div>
    <form action={toggleAction} className="cleanup-toggle-row">
      <div><label htmlFor="automaticEnabled">Automatic cleanup</label><p>Run the safe 90-day retention policy after Admin activity. Disabled by default.</p></div>
      <input id="automaticEnabled" name="automaticEnabled" type="checkbox" defaultChecked={settings.automaticEnabled} />
      <button className="button button-secondary" type="submit" disabled={togglePending}><Save size={16} aria-hidden="true" /> {togglePending ? "Saving…" : "Save Automatic Cleanup"}</button>
    </form>
    <Message state={toggleState} />
    {settings.lastRun ? <p className="field-hint">Last automatic run: <strong>{settings.lastRun.status ?? "unknown"}</strong>{settings.lastRun.finishedAt ? ` · ${new Date(settings.lastRun.finishedAt).toLocaleString("en-IN")}` : ""}</p> : <p className="field-hint">Automatic cleanup has not run yet.</p>}
    <hr className="cleanup-divider" />
    <form action={previewAction} className="cleanup-form">
      <div className="field"><label htmlFor="retentionDays">Delete data older than</label><select id="retentionDays" name="retentionDays" defaultValue="90"><option value="90">90 days</option><option value="180">180 days</option><option value="365">365 days</option></select></div>
      <fieldset className="cleanup-categories"><legend>Categories</legend>{[
        ["daily_entries", "Daily tracking"], ["gita_attendance", "Gita attendance"], ["weekly_programs", "Closed weekly programs"],
        ["attendance_records", "General attendance"], ["completed_leaves", "Completed leaves"], ["archived_resources", "Archived resources"], ["orphan_files", "Orphan files"],
      ].map(([value, label]) => <label key={value}><input type="checkbox" name="categories" value={value} defaultChecked={value !== "archived_resources"} /> {label}</label>)}</fieldset>
      <button className="button" type="submit" disabled={previewPending}><Play size={16} aria-hidden="true" /> {previewPending ? "Preparing…" : "Preview Historical Cleanup"}</button>
    </form>
    <Message state={previewState} />
    {preview ? <form action={confirmAction} className="cleanup-preview"><input type="hidden" name="runId" value={preview.id} /><div><strong>Preview ready</strong><p>Cutoff: {preview.cutoffDate ?? "—"} · {preview.categories.length} categories. Expires 15 minutes after creation.</p><p className="field-hint">Eligible records: {previewRecordCount} · Eligible orphan files: {previewObjectCount}</p></div><button className="button button-danger" type="submit" disabled={confirmPending}>{confirmPending ? "Queueing…" : "Confirm Permanent Cleanup"}</button></form> : null}
    <Message state={confirmState} />
    {runs.filter((run) => run.status === "partial" || run.status === "failed").map((run) => <form action={resumeCleanupRunAction} className="cleanup-run-row" key={run.id}><input type="hidden" name="runId" value={run.id} /><span><strong>{run.mode === "auto" ? "Automatic" : "Manual"} cleanup {run.status}</strong>{run.errorSummary ? <small>{run.errorSummary}</small> : null}</span><button className="button button-secondary" type="submit"><RotateCcw size={16} aria-hidden="true" /> Resume</button></form>)}
  </section>;
}
