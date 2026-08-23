import Link from "next/link";

export default function NotFoundPage() {
  return <main className="standalone-state"><section className="panel error-state"><p className="eyebrow">404</p><h1>Page Not Found</h1><p>The requested portal page does not exist or is no longer available.</p><Link className="button" href="/">Return to Portal</Link></section></main>;
}
