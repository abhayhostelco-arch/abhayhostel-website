"use client";

import type { ReactNode } from "react";

export function ConfirmSubmitButton({ children, message, className = "button button-danger button-small" }: { children: ReactNode; message: string; className?: string }) {
  return <button className={className} type="submit" onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{children}</button>;
}
