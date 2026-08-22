"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";

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
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [token, setToken] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || renderedRef.current) {
      return;
    }
    window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "turnstile-spin-v1",
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
      theme: "light",
    });
    renderedRef.current = true;
  }, [siteKey]);

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
