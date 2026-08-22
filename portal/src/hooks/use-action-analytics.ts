"use client";

import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/client-analytics";
import type { ActionState } from "@/lib/types";

export function useActionAnalytics(state: ActionState): void {
  const lastEvent = useRef<ActionState["analytics"]>(undefined);

  useEffect(() => {
    if (!state.analytics || state.analytics === lastEvent.current) return;
    lastEvent.current = state.analytics;
    trackAnalyticsEvent(state.analytics.name, state.analytics.params);
  }, [state.analytics]);
}
