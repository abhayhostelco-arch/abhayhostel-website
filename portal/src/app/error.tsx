"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="page-container"><section className="panel error-state" role="alert"><p className="eyebrow">Unable to Load Page</p><h1>Something went wrong</h1><p>The portal could not load this view. Check your connection and try again.</p><button className="button" type="button" onClick={reset}>Try Again</button></section></main>;
}
