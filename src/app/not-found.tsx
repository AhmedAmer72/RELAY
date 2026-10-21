import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="display-title">That page is not available</h1>
      <p className="mt-3 text-muted">Check the agreement link, or return to the dashboard.</p>
      <Link className="mt-6 inline-block text-brand" href="/dashboard">Go to dashboard</Link>
    </div>
  );
}
