"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function routeKey(url: URL) {
  return `${url.pathname}${url.search}`;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const startedAtRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRoute = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;

  useEffect(() => {
    if (!pendingRoute || pendingRoute !== currentRoute) return;

    const minimumDisplayTime = 300;
    const remainingTime = Math.max(0, minimumDisplayTime - (Date.now() - startedAtRef.current));
    const timeout = setTimeout(() => setPendingRoute(null), remainingTime);
    return () => clearTimeout(timeout);
  }, [currentRoute, pendingRoute]);

  useEffect(() => {
    function startNavigation(url: URL) {
      startedAtRef.current = Date.now();
      setPendingRoute(routeKey(url));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setPendingRoute(null), 10_000);
    }

    function handleClick(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        routeKey(destination) === routeKey(new URL(window.location.href))
      ) {
        return;
      }

      startNavigation(destination);
    }

    function handlePopState() {
      startNavigation(new URL(window.location.href));
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!pendingRoute) return null;

  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-bar" aria-hidden="true" />
      <span className="visually-hidden">Loading page…</span>
    </div>
  );
}
