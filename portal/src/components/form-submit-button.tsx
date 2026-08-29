"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function FormSubmitButton({ children, pendingLabel, className = "button" }: { children: ReactNode; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-busy={pending}>{pending ? pendingLabel : children}</button>;
}
