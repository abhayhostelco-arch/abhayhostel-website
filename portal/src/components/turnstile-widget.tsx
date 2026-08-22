"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light";
    },
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  onReadyChange,
  resetSignal,
}: {
  onReadyChange?: (ready: boolean) => void;
  resetSignal?: object;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || renderedRef.current) {
      return;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "turnstile-spin-v1",
      callback: (value) => {
        setToken(value);
        onReadyChange?.(true);
      },
      "expired-callback": () => {
        setToken("");
        onReadyChange?.(false);
      },
      "error-callback": () => {
        setToken("");
        onReadyChange?.(false);
      },
      theme: "light",
    });
    renderedRef.current = true;
  }, [onReadyChange, siteKey]);

  useEffect(() => {
    if (!resetSignal || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    setToken("");
    onReadyChange?.(false);
  }, [onReadyChange, resetSignal]);

  if (!siteKey) {
    return process.env.NODE_ENV === "development" ? (
      <p className="form-message form-error">
        Turnstile is not configured. Authentication remains fail-closed.
      </p>
    ) : null;
  }

  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} data-action="turnstile-spin-v1" />
      <input type="hidden" name="captchaToken" value={token} readOnly />
    </div>
  );
}
