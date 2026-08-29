"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Save } from "lucide-react";
import { saveDailyEntryAction } from "@/app/actions/daily-entry";
import type { DailyEntry } from "@/lib/types";
import { initialActionState } from "@/lib/types";
import { displayDate } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import { mahaMantraUploadSchema } from "@/lib/validation";

const evidenceExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function DailyEntryForm({
  selectedDate,
  entry,
  minDate,
  maxDate,
  studentId,
  ownerStudentId,
  evidenceUrl,
}: {
  selectedDate: string;
  entry?: DailyEntry;
  minDate: string;
  maxDate: string;
  studentId?: string;
  ownerStudentId: string;
  evidenceUrl?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialActionState);
  const [pending, startTransition] = useTransition();
  const successDialogRef = useRef<HTMLDialogElement>(null);
  const evidenceRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [morningStatus, setMorningStatus] = useState(entry ? (entry.morning_arati_status ?? (entry.morning_arati_attended ? "present" : "absent")) : "present");
  const [evidencePreview, setEvidencePreview] = useState<string | null>(evidenceUrl ?? null);
  const hours = entry ? Math.floor(entry.study_minutes / 60) : 0;
  const minutes = entry ? entry.study_minutes % 60 : 0;

  useEffect(() => {
    if (state.status === "success" && !successDialogRef.current?.open) {
      setDirty(false);
      successDialogRef.current?.showModal();
    }
  }, [state]);

  useEffect(() => () => { if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current); }, []);

  useEffect(() => {
    if (!dirty || pending) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, pending]);

  function chooseEvidence(file?: File) {
    if (!file) return;
    if (!mahaMantraUploadSchema.safeParse({ type: file.type, size: file.size }).success) {
      setState({ status: "error", message: "Use a JPG, PNG, or WebP image no larger than 5 MB." });
      if (evidenceRef.current) evidenceRef.current.value = "";
      return;
    }
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = URL.createObjectURL(file);
    setEvidencePreview(previewObjectUrlRef.current);
    setDirty(true);
    setState(initialActionState);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      setState(initialActionState);
      const file = evidenceRef.current?.files?.[0];
      let nextPath = morningStatus === "present" ? null : (entry?.maha_mantra_path ?? null);
      let uploadedPath: string | null = null;
      const supabase = createClient();
      if (!studentId && morningStatus !== "present" && !file && !nextPath) {
        setState({ status: "error", message: "Upload a Maha Mantra picture when late or absent." });
        return;
      }
      if (file) {
        if (!mahaMantraUploadSchema.safeParse({ type: file.type, size: file.size }).success) {
          setState({ status: "error", message: "Use a JPG, PNG, or WebP image no larger than 5 MB." });
          return;
        }
        const entryDate = String(formData.get("entryDate") ?? selectedDate);
        uploadedPath = `${ownerStudentId}/${entryDate}/maha-mantra-${Date.now()}.${evidenceExtensions[file.type]}`;
        const upload = await supabase.storage.from("maha-mantra-evidence").upload(uploadedPath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
        if (upload.error) {
          setState({ status: "error", message: upload.error.message.toLowerCase().includes("bucket") ? "Maha Mantra uploads are unavailable until the database migration is applied." : "The Maha Mantra picture could not be uploaded." });
          return;
        }
        nextPath = uploadedPath;
      }
      formData.set("morningAratiStatus", morningStatus);
      formData.set("mahaMantraPath", nextPath ?? "");
      const result = await saveDailyEntryAction(initialActionState, formData);
      if (result.status !== "success") {
        if (uploadedPath) await supabase.storage.from("maha-mantra-evidence").remove([uploadedPath]);
        setState(result);
        return;
      }
      if (entry?.maha_mantra_path && entry.maha_mantra_path !== nextPath) await supabase.storage.from("maha-mantra-evidence").remove([entry.maha_mantra_path]);
      setDirty(false);
      setState(result);
      router.refresh();
    });
  }

  return (
    <>
      <form action={submit} className="split-form" onChange={() => setDirty(true)}>
      {studentId ? <input type="hidden" name="studentId" value={studentId} /> : null}
      <div className="full-span form-submit-bar">
        <button className="button" type="submit" disabled={pending}>
          <Save size={18} aria-hidden="true" />
          {pending ? "Saving…" : entry ? "Update Daily Entry" : "Save Daily Entry"}
        </button>
      </div>
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
          <div className="field"><label htmlFor="morningAratiStatus">Morning Arati</label><select id="morningAratiStatus" name="morningAratiStatus" value={morningStatus} onChange={(event) => { setMorningStatus(event.target.value as "present" | "late" | "absent"); setDirty(true); }}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select></div>
          {morningStatus !== "present" ? <div className="field full-span evidence-upload"><label>Maha Mantra picture{studentId ? " (optional staff correction)" : ""}</label>{evidencePreview ? <Image className="evidence-preview" src={evidencePreview} width={240} height={180} alt="Maha Mantra evidence preview" unoptimized /> : null}{!studentId ? <div className="actions-row"><label className="button button-secondary button-small" htmlFor="mahaMantraFile"><Camera size={16} aria-hidden="true" /> {evidencePreview ? "Replace picture" : "Choose picture"}</label></div> : evidenceUrl ? <a className="button button-secondary button-small" href={evidenceUrl} target="_blank" rel="noreferrer">View evidence</a> : <p className="field-hint">Evidence not provided.</p>}<input ref={evidenceRef} className="visually-hidden" id="mahaMantraFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseEvidence(event.target.files?.[0])} /><p className="field-hint">JPG, PNG, or WebP. Maximum 5 MB.</p></div> : null}
          <div className="field"><label htmlFor="eveningReadingMinutes">Evening book reading (minutes)</label><input id="eveningReadingMinutes" name="eveningReadingMinutes" type="number" min={0} max={360} defaultValue={entry?.evening_reading_minutes ?? 0} required /></div>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Study</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="studyHours">Study hours</label><input id="studyHours" name="studyHours" type="number" min={0} max={18} defaultValue={hours} required /></div>
          <div className="field"><label htmlFor="studyMinutes">Additional minutes</label><input id="studyMinutes" name="studyMinutes" type="number" min={0} max={59} defaultValue={minutes} required /></div>
          <input name="libraryAttended" type="hidden" value={entry?.library_attended ? "on" : "off"} />
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Discipline</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="sleepTime">Previous night sleep time</label><input id="sleepTime" name="sleepTime" type="time" defaultValue={entry?.sleep_time.slice(0, 5) ?? "20:30"} required /></div>
          <div className="field"><label htmlFor="wakeTime">Wake-up time</label><input id="wakeTime" name="wakeTime" type="time" defaultValue={entry?.wake_time.slice(0, 5) ?? "04:00"} required /></div>
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
