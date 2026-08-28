"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";
import { createClient } from "@/lib/supabase/client";
import { initialActionState, type ActionState } from "@/lib/types";
import { avatarUploadSchema } from "@/lib/validation";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export function ProfileSettingsForm({
  profileId,
  birthDate,
  avatarPath,
  avatarUrl,
  maxDate,
  showBirthDate = true,
}: {
  profileId: string;
  birthDate: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  maxDate: string;
  showBirthDate?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [state, setState] = useState<ActionState>(initialActionState);
  const [pending, startTransition] = useTransition();

  function chooseFile(file?: File) {
    if (!file) return;
    const parsed = avatarUploadSchema.safeParse({ type: file.type, size: file.size });
    if (!parsed.success) {
      setState({ status: "error", message: "Use a JPG, PNG, or WebP image no larger than 2 MB." });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setRemoveAvatar(false);
    setPreview(URL.createObjectURL(file));
    setState(initialActionState);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      setState(initialActionState);
      const supabase = createClient();
      const file = fileRef.current?.files?.[0];
      let nextPath = removeAvatar ? null : avatarPath;
      let uploadedPath: string | null = null;
      if (file) {
        const parsed = avatarUploadSchema.safeParse({ type: file.type, size: file.size });
        if (!parsed.success) {
          setState({ status: "error", message: "Use a JPG, PNG, or WebP image no larger than 2 MB." });
          return;
        }
        uploadedPath = `${profileId}/avatar-${Date.now()}.${extensions[file.type]}`;
        const upload = await supabase.storage.from("student-avatars").upload(uploadedPath, file, {
          cacheControl: "3600", contentType: file.type, upsert: false,
        });
        if (upload.error) {
          setState({ status: "error", message: upload.error.message.toLowerCase().includes("bucket")
            ? "Profile pictures are unavailable until the new migration is applied."
            : "The profile picture could not be uploaded." });
          return;
        }
        nextPath = uploadedPath;
      }
      formData.set("avatarPath", nextPath ?? "");
      const result = await updateProfileAction(initialActionState, formData);
      if (result.status !== "success") {
        if (uploadedPath) await supabase.storage.from("student-avatars").remove([uploadedPath]);
        setState(result);
        return;
      }
      if (avatarPath && avatarPath !== nextPath) {
        await supabase.storage.from("student-avatars").remove([avatarPath]);
      }
      setState(result);
      router.refresh();
    });
  }

  return <form action={submit} className="profile-settings-grid">
    <section className="avatar-editor" aria-labelledby="avatar-title">
      <div className="profile-preview">
        {preview && !removeAvatar ? <Image src={preview} width={128} height={128} alt="Profile picture preview" unoptimized /> : <span aria-hidden="true">You</span>}
      </div>
      <div><h2 id="avatar-title">Profile picture</h2><p className="field-hint">JPG, PNG, or WebP. Maximum 2 MB.</p></div>
      <label className="button button-secondary" htmlFor="avatarFile"><Camera size={17} aria-hidden="true" /> Choose picture</label>
      <input ref={fileRef} className="visually-hidden" id="avatarFile" name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
      {(avatarPath || preview) && !removeAvatar ? <button className="button button-danger" type="button" onClick={() => { setRemoveAvatar(true); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}><Trash2 size={17} aria-hidden="true" /> Remove picture</button> : null}
    </section>
    <section className="profile-fields" aria-labelledby="personal-title">
      <div><h2 id="personal-title">{showBirthDate ? "Personal details" : "Profile picture"}</h2><p className="field-hint">Only you can change these profile details.</p></div>
      {showBirthDate ? <div className="field"><label htmlFor="birthDate">Birthdate (optional)</label><input id="birthDate" name="birthDate" type="date" defaultValue={birthDate ?? ""} max={maxDate} /></div> : null}
      {state.message ? <p className={`form-message ${state.status === "success" ? "form-success" : "form-error"}`} role="status">{state.message}</p> : null}
      <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </section>
  </form>;
}
