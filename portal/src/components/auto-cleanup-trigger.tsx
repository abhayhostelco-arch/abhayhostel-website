"use client";

import { useEffect } from "react";

export function AutoCleanupTrigger() {
  useEffect(() => {
    void fetch("/api/admin/cleanup/auto", { method: "POST", keepalive: true }).catch(() => undefined);
  }, []);
  return null;
}
