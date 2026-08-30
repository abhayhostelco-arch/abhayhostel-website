"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light" | "dark";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
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
  const { resolvedTheme, hydrated } = useTheme();
  const generationRef = useRef(0);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (!hydrated || !siteKey || !containerRef.current || !window.turnstile || renderedRef.current) {
      return;
    }
    const generation = generationRef.current;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "turnstile-spin-v1",
      callback: (value) => {
        if (generation !== generationRef.current) return;
        setToken(value);
        onReadyChange?.(true);
      },
      "expired-callback": () => {
        if (generation !== generationRef.current) return;
        setToken("");
        onReadyChange?.(false);
      },
      "error-callback": () => {
        if (generation !== generationRef.current) return;
        setToken("");
        onReadyChange?.(false);
      },
      theme: resolvedTheme,
    });
    renderedRef.current = true;
  }, [hydrated, onReadyChange, resolvedTheme, siteKey]);

  useEffect(() => {
    if (!hydrated || !hydratedTheme(resolvedTheme)) return;
    generationRef.current += 1;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      renderedRef.current = false;
    }
    queueMicrotask(() => setToken(""));
    onReadyChange?.(false);
    renderWidget();
  }, [hydrated, onReadyChange, renderWidget, resolvedTheme]);

  useEffect(() => {
    if (!hydrated || !resetSignal || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    setToken("");
    onReadyChange?.(false);
  }, [hydrated, onReadyChange, resetSignal]);

  useEffect(() => () => {
    generationRef.current += 1;
    if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
  }, []);

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

function hydratedTheme(theme: string): theme is "light" | "dark" {
  return theme === "light" || theme === "dark";
}
