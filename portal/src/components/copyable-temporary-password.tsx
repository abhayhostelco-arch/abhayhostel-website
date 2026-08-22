"use client";

import { useState } from "react";
import { Check, Clipboard } from "lucide-react";

export function CopyableTemporaryPassword({
  password,
  className = "",
}: {
  password: string;
  className?: string;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyPassword() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(password);
      setCopyStatus("copied");
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = password;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      const copied = document.execCommand("copy");
      fallback.remove();
      setCopyStatus(copied ? "copied" : "failed");
    }
  }

  return (
    <div className={`temporary-password ${className}`.trim()}>
      <span>Temporary password</span>
      <code>{password}</code>
      <button
        className="copy-password-button"
        type="button"
        onClick={copyPassword}
        aria-label="Copy temporary password to clipboard"
      >
        {copyStatus === "copied" ? <Check size={16} aria-hidden="true" /> : <Clipboard size={16} aria-hidden="true" />}
        {copyStatus === "copied" ? "Copied" : "Copy"}
      </button>
      {copyStatus === "failed" ? (
        <span className="copy-password-feedback" role="status">
          Copy failed. Select the password and copy it manually.
        </span>
      ) : (
        <span className="visually-hidden" aria-live="polite">
          {copyStatus === "copied" ? "Temporary password copied to clipboard." : ""}
        </span>
      )}
    </div>
  );
}
