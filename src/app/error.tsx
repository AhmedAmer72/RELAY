"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 p-5" role="alert">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">RELAY could not render this page. No transaction was sent.</p>
      <button type="button" className="mt-4 rounded-xl border border-line px-4 py-2 text-sm" onClick={reset}>Try again</button>
    </div>
  );
}
