"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { resetAccountPasswordAction } from "@/app/actions/accounts";
import { initialActionState } from "@/lib/types";
import { CopyableTemporaryPassword } from "@/components/copyable-temporary-password";

export function AccountResetForm({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState(
    resetAccountPasswordAction,
    initialActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="targetId" value={targetId} />
      <button className="button button-secondary button-small" type="submit" disabled={pending}>
        <KeyRound size={14} aria-hidden="true" /> Reset
      </button>
      {state.message ? (
        <p className={`form-message ${state.status === "success" ? "form-success" : "form-error"}`}>
          {state.message}
        </p>
      ) : null}
      {state.temporaryPassword ? (
        <CopyableTemporaryPassword
          key={state.temporaryPassword}
          password={state.temporaryPassword}
        />
      ) : null}
    </form>
  );
}
