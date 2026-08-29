"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Send } from "lucide-react";
import { createLeaveAttachmentUploadAction, createLeaveRequestAction } from "@/app/actions/leave";
import { createClient } from "@/lib/supabase/client";
import { initialActionState, type ActionState } from "@/lib/types";
import { flattenErrors, leaveAttachmentUploadSchema, leaveRequestDetailsSchema } from "@/lib/validation";

export function LeaveRequestForm({ studentId, minDate }: { studentId: string; minDate: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [state, setState] = useState<ActionState>(initialActionState);
  const [pending, startTransition] = useTransition();

  function selectFile(file?: File) {
    if (!file) return;
    if (!leaveAttachmentUploadSchema.safeParse({ type: file.type, size: file.size }).success) {
      setState({ status: "error", message: "Use a JPG, PNG, or PDF no larger than 5 MB." });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFileName(file.name);
    setState(initialActionState);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const details = leaveRequestDetailsSchema.safeParse({
      startDate: formData.get("startDate"), endDate: formData.get("endDate"), reason: formData.get("reason"),
    });
    if (!details.success) {
      setFieldErrors(flattenErrors(details.error));
      setState(initialActionState);
      return;
    }
    setFieldErrors({});
    startTransition(async () => {
      setState(initialActionState);
      const requestId = crypto.randomUUID();
      const file = fileRef.current?.files?.[0];
      let uploadedPath: string | null = null;
      if (file) {
        if (!leaveAttachmentUploadSchema.safeParse({ type: file.type, size: file.size }).success) {
          setState({ status: "error", message: "Use a JPG, PNG, or PDF no larger than 5 MB." });
          return;
        }
        const grant = await createLeaveAttachmentUploadAction({ requestId, type: file.type, size: file.size });
        if (grant.status === "error" || !grant.path.startsWith(`${studentId}/${requestId}/`)) {
          setState({ status: "error", message: grant.status === "error" ? grant.message : "The application attachment could not be prepared for upload." });
          return;
        }
        uploadedPath = grant.path;
        const upload = await createClient().storage.from("leave-applications").uploadToSignedUrl(uploadedPath, grant.token, file, { cacheControl: "3600", contentType: file.type });
        if (upload.error) {
          setState({ status: "error", message: "The application attachment could not be uploaded." });
          return;
        }
      }
      formData.set("requestId", requestId);
      formData.set("attachmentPath", uploadedPath ?? "");
      const result = await createLeaveRequestAction(initialActionState, formData);
      if (result.status !== "success") {
        setState(result);
        return;
      }
      formRef.current?.reset();
      setFileName(null);
      setFieldErrors({});
      setState(result);
      router.refresh();
    });
  }

  function updateFieldErrors(form: HTMLFormElement) {
    if (!Object.keys(fieldErrors).length) return;
    const data = new FormData(form);
    const parsed = leaveRequestDetailsSchema.safeParse({ startDate: data.get("startDate"), endDate: data.get("endDate"), reason: data.get("reason") });
    setFieldErrors(parsed.success ? {} : flattenErrors(parsed.error));
  }

  return <form ref={formRef} onSubmit={submit} onInput={(event) => updateFieldErrors(event.currentTarget)} className="split-form" noValidate>
    <div className="field"><label htmlFor="leaveStartDate">From</label><input id="leaveStartDate" name="startDate" type="date" min={minDate} required aria-invalid={Boolean(fieldErrors.startDate)} aria-describedby={fieldErrors.startDate ? "leaveStartDateError" : undefined} />{fieldErrors.startDate ? <p id="leaveStartDateError" className="field-error">{fieldErrors.startDate[0]}</p> : null}</div>
    <div className="field"><label htmlFor="leaveEndDate">To</label><input id="leaveEndDate" name="endDate" type="date" min={minDate} required aria-invalid={Boolean(fieldErrors.endDate)} aria-describedby={fieldErrors.endDate ? "leaveEndDateError" : undefined} />{fieldErrors.endDate ? <p id="leaveEndDateError" className="field-error">{fieldErrors.endDate[0]}</p> : null}</div>
    <div className="field full-span"><label htmlFor="leaveReason">Reason</label><textarea id="leaveReason" name="reason" minLength={3} maxLength={1000} required placeholder="Explain why you need to go home…" aria-invalid={Boolean(fieldErrors.reason)} aria-describedby={fieldErrors.reason ? "leaveReasonError" : undefined} />{fieldErrors.reason ? <p id="leaveReasonError" className="field-error">{fieldErrors.reason[0]}</p> : null}</div>
    <div className="field full-span"><label>Application attachment (optional)</label><label className="button button-secondary button-small upload-button" htmlFor="leaveAttachment"><FileUp size={16} aria-hidden="true" /> Choose JPG, PNG, or PDF</label><input ref={fileRef} className="visually-hidden" id="leaveAttachment" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => selectFile(event.target.files?.[0])} />{fileName ? <p className="field-hint">Selected: {fileName}</p> : <p className="field-hint">Maximum 5 MB.</p>}</div>
    {state.message ? <p className={`form-message full-span ${state.status === "success" ? "form-success" : "form-error"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    <div className="full-span"><button className="button" type="submit" disabled={pending}><Send size={17} aria-hidden="true" /> {pending ? "Submitting…" : "Submit for Approval"}</button></div>
  </form>;
}
