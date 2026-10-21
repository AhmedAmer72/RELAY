"use client";

import Link from "next/link";
import { cloneElement, isValidElement, useEffect, useId, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  href?: string;
};

export function Button({ variant = "primary", busy, className, children, disabled, href, ...props }: ButtonProps) {
  const classes = cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        variant === "primary" && "bg-brand text-brand-ink hover:bg-brand-hover",
        variant === "secondary" && "border border-ink/15 bg-white text-ink hover:bg-raised",
        variant === "ghost" && "text-ink hover:bg-raised",
        variant === "danger" && "border border-danger/40 text-danger hover:bg-danger/10",
        className,
      );
  if (href && !disabled && !busy) {
    return <Link href={href} className={classes}>{children}</Link>;
  }
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={classes}
    >
      {busy ? "Working…" : children}
    </button>
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return <section style={style} className={cn("rounded-[28px] border border-line bg-surface p-5 shadow-[0_10px_30px_rgb(14_15_12_/_4%)] transition duration-300", className)}>{children}</section>;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ id?: string; "aria-invalid"?: boolean }>, {
        id,
        "aria-invalid": Boolean(error) || undefined,
      })
    : children;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">{label}</label>
      {control}
      {hint && !error ? <span className="mt-2 block text-sm font-medium text-muted">{hint}</span> : null}
      {error ? <span className="mt-2 block text-sm font-semibold text-danger" role="alert">{error}</span> : null}
    </div>
  );
}

export const controlClass =
  "w-full min-h-12 rounded-2xl border-2 border-[#163300] bg-white px-4 py-3.5 text-base text-ink outline-none transition placeholder:text-[#3f443c] hover:bg-[#fbfff6] focus:border-[#163300] focus:ring-4 focus:ring-[#9fe870] aria-invalid:border-[#9f1c1c] aria-invalid:ring-4 aria-invalid:ring-[#f0b4b4]";

export function FilterChip({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-semibold transition duration-200",
        active ? "bg-brand text-brand-ink" : "border border-line bg-white text-muted hover:border-ink/20 hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StepRail({ steps, current, label }: { steps: readonly string[]; current: number; label: string }) {
  const clamped = Math.max(0, Math.min(current, steps.length - 1));
  const progress = steps.length <= 1 ? 100 : (clamped / (steps.length - 1)) * 100;
  const style = {
    "--rail": `${progress}%`,
    "--rail-span": `${steps.length <= 1 ? 1 : (steps.length - 1) / steps.length}`,
    gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
  } as CSSProperties;
  return (
    <ol className="rail" style={style} aria-label={label}>
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className={cn("text-xs", index <= current ? "font-medium text-ink" : "text-faint", index < current && "is-done")}
        >
          <span className="rail-mark" aria-hidden />
          {index + 1}. {step}
        </li>
      ))}
    </ol>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "border-line bg-raised text-muted",
        tone === "info" && "border-info/40 bg-info/10 text-info",
        tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
        tone === "success" && "border-transparent bg-meadow text-brand",
        tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function EmptyState({ title, copy, children }: { title: string; copy: string; children?: ReactNode }) {
  return (
    <Card className="text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{copy}</p>
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </Card>
  );
}

export function ErrorPanel({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4" role="alert">
      <p className="font-semibold text-danger">{title}</p>
      {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
      {onRetry ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-raised", className)} />;
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#03070d]/75 p-4 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="relay-dialog-title"
        className="dialog-panel form-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="relay-dialog-title" className="text-lg font-semibold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <button
      type="button"
      className="text-sm font-semibold text-brand underline decoration-meadow decoration-2 underline-offset-4"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
      }}
    >
      {label}
    </button>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline decoration-meadow decoration-2 underline-offset-4">
      {children}
    </a>
  );
}
