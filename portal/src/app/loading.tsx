export default function Loading() {
  return <main className="page-container" aria-busy="true" aria-live="polite"><span className="visually-hidden">Loading…</span><div className="skeleton skeleton-heading" /><div className="skeleton-grid"><div className="skeleton skeleton-metric" /><div className="skeleton skeleton-metric" /><div className="skeleton skeleton-metric" /><div className="skeleton skeleton-metric" /></div><div className="skeleton skeleton-panel" /></main>;
}
