"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, LoaderCircle, Save, X } from "lucide-react";
import { createDailyEntryEvidenceUploadAction, removeDailyEntryEvidenceAction, saveDailyEntryAction } from "@/app/actions/daily-entry";
import type { DailyEntry } from "@/lib/types";
import type { ActionState } from "@/lib/types";
import { initialActionState } from "@/lib/types";
import { displayDate } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import {
  classifyEvidenceUploadError,
  evidencePurgedMessage,
  evidenceRequiredMessage,
  validateEvidenceFile,
  withEvidenceUploadTimeout,
} from "@/lib/daily-entry-upload";

function FieldErrors({ errors }: { errors?: string[] }) {
  return errors?.map((message) => <p className="field-error" role="alert" key={message}>{message}</p>) ?? null;
}

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
  const [operationStage, setOperationStage] = useState<"idle" | "uploading" | "saving">("idle");
  const successDialogRef = useRef<HTMLDialogElement>(null);
  const evidenceRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [morningStatus, setMorningStatus] = useState(entry ? (entry.morning_arati_status ?? (entry.morning_arati_attended ? "present" : "absent")) : "present");
  const [evidencePreview, setEvidencePreview] = useState<string | null>(evidenceUrl ?? null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceCleared, setEvidenceCleared] = useState(false);
  const [evidenceInputVersion, setEvidenceInputVersion] = useState(0);
  const hours = entry ? Math.floor(entry.study_minutes / 60) : 0;
  const minutes = entry ? entry.study_minutes % 60 : 0;

  useEffect(() => {
    if (state.status === "success" && !successDialogRef.current?.open) {
      setDirty(false);
      successDialogRef.current?.showModal();
    }
  }, [state]);

  useEffect(() => {
    if (state.status !== "error") return;
    alertRef.current?.focus();
    alertRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [state]);

  useEffect(() => () => { if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current); }, []);

  useEffect(() => {
    if (!dirty || operationStage !== "idle") return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, operationStage]);

  function discardSelectedEvidence(clearExisting = evidenceCleared) {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
    setEvidenceFile(null);
    setEvidencePreview(clearExisting ? null : (evidenceUrl ?? null));
    setEvidenceCleared(clearExisting);
    if (evidenceRef.current) evidenceRef.current.value = "";
    setEvidenceInputVersion((version) => version + 1);
  }

  function removeEvidence() {
    if (operationStage !== "idle") return;
    discardSelectedEvidence(true);
    setDirty(true);
    setState({ status: "error", message: evidenceRequiredMessage, fieldErrors: { mahaMantraPath: [evidenceRequiredMessage] } });
  }

  async function chooseEvidence(file?: File) {
    if (!file) {
      discardSelectedEvidence();
      return;
    }
    setEvidenceFile(file);
    const validationMessage = await validateEvidenceFile(file);
    if (validationMessage) {
      discardSelectedEvidence();
      setState({ status: "error", message: validationMessage, fieldErrors: { mahaMantraPath: [validationMessage] } });
      return;
    }
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = URL.createObjectURL(file);
    setEvidenceFile(file);
    setEvidencePreview(previewObjectUrlRef.current);
    setEvidenceCleared(false);
    setDirty(true);
    setState(initialActionState);
  }

  function logFailure(stage: "validation" | "upload" | "save" | "cleanup", error: unknown, context: Record<string, string | number | boolean>) {
    const value = error as { code?: string; status?: number; statusCode?: number; name?: string } | null;
    console.error("Daily entry operation failed", {
      stage,
      code: value?.code ?? value?.name ?? value?.statusCode ?? value?.status ?? "unknown",
      context,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (operationStage !== "idle") return;
      const formData = new FormData(event.currentTarget);
      setState(initialActionState);
      const file = evidenceFile;
      let nextPath = morningStatus === "present" || evidenceCleared ? null : (entry?.maha_mantra_path ?? null);
      let uploadedPath: string | null = null;
      const context = { entryDate: String(formData.get("entryDate") ?? selectedDate), fileSize: file?.size ?? 0, fileType: file?.type ?? "none" };
      if (morningStatus !== "present" && !file && !nextPath) {
        setState({ status: "error", message: evidenceRequiredMessage, fieldErrors: { mahaMantraPath: [evidenceRequiredMessage] } });
        return;
      }
      if (file) {
        const validationMessage = await validateEvidenceFile(file);
        if (validationMessage) {
          logFailure("validation", { code: "INVALID_IMAGE" }, context);
          setState({ status: "error", message: validationMessage, fieldErrors: { mahaMantraPath: [validationMessage] } });
          return;
        }
        const entryDate = String(formData.get("entryDate") ?? selectedDate);
        const grant = await createDailyEntryEvidenceUploadAction({ studentId: ownerStudentId, entryDate, type: file.type, size: file.size });
        if (grant.status === "error" || !grant.path.startsWith(`${ownerStudentId}/${entryDate}/`)) {
          setState({ status: "error", message: grant.status === "error" ? grant.message : "The image storage service rejected the upload. Your form data is preserved; try another image or contact the administrator." });
          return;
        }
        uploadedPath = grant.path;
        setOperationStage("uploading");
        try {
          const upload = await withEvidenceUploadTimeout(createClient().storage.from("maha-mantra-evidence").uploadToSignedUrl(uploadedPath, grant.token, file, { cacheControl: "3600", contentType: file.type }));
          if (upload.error) throw upload.error;
        } catch (error) {
          logFailure("upload", error, context);
          setOperationStage("idle");
          setState({ status: "error", message: classifyEvidenceUploadError(error as Parameters<typeof classifyEvidenceUploadError>[0]) });
          return;
        }
        nextPath = uploadedPath;
      }
      formData.set("morningAratiStatus", morningStatus);
      formData.set("mahaMantraPath", nextPath ?? "");
      setOperationStage("saving");
      let result: ActionState;
      try {
        result = await saveDailyEntryAction(initialActionState, formData);
      } catch (error) {
        logFailure("save", error, context);
        result = { status: "error", message: "The entry was not saved. Your form data is preserved; try again." };
      }
      if (result.status !== "success") {
        logFailure("save", { code: result.fieldErrors ? "ENTRY_VALIDATION" : "ENTRY_SAVE_REJECTED" }, context);
        let cleanupFailed = false;
        if (uploadedPath) {
          try {
            cleanupFailed = !await removeDailyEntryEvidenceAction({ studentId: ownerStudentId, entryDate: String(formData.get("entryDate") ?? selectedDate), path: uploadedPath });
            if (cleanupFailed) logFailure("cleanup", { code: "CLEANUP_REJECTED" }, context);
          } catch (error) {
            cleanupFailed = true;
            logFailure("cleanup", error, context);
          }
        }
        setOperationStage("idle");
        setState({
          ...result,
          message: cleanupFailed
            ? "The entry was not saved. Your form data is preserved. The temporary image will be removed automatically."
            : result.fieldErrors
              ? "The entry was not saved. Correct the highlighted fields and try again."
              : uploadedPath
                ? "The image uploaded, but the daily entry could not be saved. Your form data is preserved; try again."
                : (result.message ?? "The entry was not saved. Your form data is preserved; try again."),
        });
        return;
      }
      if (entry?.maha_mantra_path && entry.maha_mantra_path !== nextPath) {
        await removeDailyEntryEvidenceAction({ studentId: ownerStudentId, entryDate: selectedDate, path: entry.maha_mantra_path });
      }
      setOperationStage("idle");
      setDirty(false);
      setState(result);
      router.refresh();
  }

  return (
    <>
      <form onSubmit={submit} className="split-form" onChange={() => setDirty(true)}>
      {studentId ? <input type="hidden" name="studentId" value={studentId} /> : null}
      <div className="full-span form-submit-bar">
        <button className="button" type="submit" disabled={operationStage !== "idle"} aria-busy={operationStage !== "idle"}>
          {operationStage === "idle" ? <Save size={18} aria-hidden="true" /> : <LoaderCircle className="button-spinner" size={18} aria-hidden="true" />}
          {operationStage === "uploading" ? "Uploading image…" : operationStage === "saving" ? "Saving entry…" : entry ? "Update Daily Entry" : "Save Daily Entry"}
        </button>
      </div>
      {state.message && state.status === "error" ? <div ref={alertRef} className="form-message form-error full-span" role="alert" tabIndex={-1}>{state.message}</div> : null}
      <fieldset className="form-operation-fields split-form full-span" disabled={operationStage !== "idle"}>
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
        <FieldErrors errors={state.fieldErrors?.entryDate} />
      </div>
      <fieldset className="routine-section full-span">
        <legend>Sadhana</legend>
        <div className="split-form">
          <div className="field">
            <label htmlFor="chantingRounds">Morning meditation (chanting rounds)</label>
            <input id="chantingRounds" name="chantingRounds" type="number" min={0} max={108} step={1} defaultValue={entry ? entry.chanting_rounds ?? "" : 0} required />
            <FieldErrors errors={state.fieldErrors?.chantingRounds} />
          </div>
          <div className="field">
            <label htmlFor="gitaClassStatus">Gita class attendance</label>
            <select id="gitaClassStatus" name="gitaClassStatus" defaultValue={entry?.gita_class_status ?? "present"}>
              <option value="present">Present</option><option value="absent">Absent</option><option value="no_class">No class</option>
            </select>
            <FieldErrors errors={state.fieldErrors?.gitaClassStatus} />
          </div>
          <div className="field"><label htmlFor="morningAratiStatus">Morning Arati</label><select id="morningAratiStatus" name="morningAratiStatus" value={morningStatus} onChange={(event) => { const status = event.target.value as "present" | "late" | "absent"; setMorningStatus(status); if (status === "present") discardSelectedEvidence(true); setDirty(true); }}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select><FieldErrors errors={state.fieldErrors?.morningAratiStatus} /></div>
          {morningStatus !== "present" ? <div className="field full-span evidence-upload">
            <label htmlFor="mahaMantraFile">Maha Mantra picture</label>
            {evidencePreview ? <div className="evidence-preview-wrap">
              <Image className="evidence-preview" src={evidencePreview} width={240} height={180} alt="Maha Mantra evidence preview" unoptimized />
              <button className="evidence-remove-button" type="button" aria-label="Remove selected image" onClick={removeEvidence}>
                <X size={16} aria-hidden="true" />
              </button>
            </div> : entry?.maha_mantra_purged_at ? <p className="field-hint">{evidencePurgedMessage}</p> : null}
            <div className="actions-row"><label className="button button-secondary button-small" htmlFor="mahaMantraFile"><Camera size={16} aria-hidden="true" /> {evidencePreview ? "Replace picture" : "Choose picture"}</label>{evidenceUrl && !evidenceFile ? <a className="button button-secondary button-small" href={evidenceUrl} target="_blank" rel="noreferrer">View evidence</a> : null}</div>
            <input key={evidenceInputVersion} ref={evidenceRef} aria-label="Choose Maha Mantra image" className="visually-hidden" id="mahaMantraFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseEvidence(event.target.files?.[0])} />
            <FieldErrors errors={state.fieldErrors?.mahaMantraPath} />
            <p className="field-hint">JPG, PNG, or WebP. Maximum 5 MB.</p>
          </div> : null}
          <div className="field"><label htmlFor="eveningReadingMinutes">Evening book reading (minutes)</label><input id="eveningReadingMinutes" name="eveningReadingMinutes" type="number" min={0} max={360} defaultValue={entry?.evening_reading_minutes ?? 0} required /><FieldErrors errors={state.fieldErrors?.eveningReadingMinutes} /></div>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Study</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="studyHours">Study hours</label><input id="studyHours" name="studyHours" type="number" min={0} max={18} defaultValue={hours} required /><FieldErrors errors={state.fieldErrors?.studyHours} /></div>
          <div className="field"><label htmlFor="studyMinutes">Additional minutes</label><input id="studyMinutes" name="studyMinutes" type="number" min={0} max={59} defaultValue={minutes} required /><FieldErrors errors={state.fieldErrors?.studyMinutes} /></div>
          <input name="libraryAttended" type="hidden" value={entry?.library_attended ? "on" : "off"} />
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Discipline</legend>
        <div className="split-form">
          <div className="field"><label htmlFor="sleepTime">Previous night sleep time</label><input id="sleepTime" name="sleepTime" type="time" defaultValue={entry?.sleep_time.slice(0, 5) ?? "20:30"} required /><FieldErrors errors={state.fieldErrors?.sleepTime} /></div>
          <div className="field"><label htmlFor="wakeTime">Wake-up time</label><input id="wakeTime" name="wakeTime" type="time" defaultValue={entry?.wake_time.slice(0, 5) ?? "04:00"} required /><FieldErrors errors={state.fieldErrors?.wakeTime} /></div>
        </div>
      </fieldset>
      <fieldset className="routine-section full-span">
        <legend>Seva &amp; Character</legend>
        <div className="field"><label htmlFor="sevaMinutes">Seva (minutes)</label><input id="sevaMinutes" name="sevaMinutes" type="number" min={0} max={720} defaultValue={entry?.seva_minutes ?? 0} required /><FieldErrors errors={state.fieldErrors?.sevaMinutes} /></div>
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
        <FieldErrors errors={state.fieldErrors?.note} />
      </div>
      </fieldset>
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
