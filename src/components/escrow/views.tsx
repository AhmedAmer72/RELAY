"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chain/config";
import { describeEvent, type ChainEvent } from "@/lib/chain/logs";
import { AUTO_RELEASE_DISCLOSURE, EVIDENCE_DISCLOSURE, FUNDS_DISCLOSURE, NO_FEE_DISCLOSURE, RESOLVER_DISCLOSURE, STATE_LABELS } from "@/lib/escrow/constants";
import { formatMusd, isZeroAddress, shortAddress } from "@/lib/escrow/format";
import { formatRelative, formatTimestamp } from "@/lib/escrow/time";
import type { ActionId, EscrowModel, EscrowState, PanelModel, TxPhase } from "@/lib/escrow/types";
import { safeHttpsUrl } from "@/lib/metadata/canonical";
import { Badge, Button, Card, CopyButton, ErrorPanel, ExternalLink, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const TONE: Record<EscrowState, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Created: "neutral",
  Funded: "info",
  Delivered: "warning",
  Released: "success",
  Refunded: "neutral",
  Disputed: "danger",
  Cancelled: "neutral",
  Split: "success",
};

export function StatusBadge({ state }: { state: EscrowState }) {
  return <Badge tone={TONE[state]}>{STATE_LABELS[state]}</Badge>;
}

export function ProgressRail({ state }: { state: EscrowState }) {
  const labels = ["Created", "Funded", state === "Disputed" ? "Disputed" : "Delivered", state === "Refunded" ? "Refunded" : state === "Cancelled" ? "Cancelled" : "Settled"];
  const index = state === "Cancelled" || state === "Created" ? 0 : state === "Funded" ? 1 : state === "Delivered" || state === "Disputed" ? 2 : 3;
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const progress = drawn ? (index / (labels.length - 1)) * 100 : 0;
  const style = { "--rail": `${progress}%`, "--rail-span": `${(labels.length - 1) / labels.length}`, gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` } as CSSProperties;
  return (
    <ol className="rail" style={style} aria-label="Agreement progress">
      {labels.map((label, step) => (
        <li key={label} aria-current={step === index ? "step" : undefined} className={cn("text-xs", step <= index ? "font-medium text-ink" : "text-faint", step < index && "is-done")}>
          <span className="rail-mark" aria-hidden />
          {label}
        </li>
      ))}
    </ol>
  );
}

export function PartyRow({ role, address }: { role: string; address?: string }) {
  const href = explorerAddressUrl(address);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-faint">{role}</span>
      {address && !isZeroAddress(address) ? (
        <span className="flex items-center gap-2">
          <span className="num" title={address}>{shortAddress(address)}</span>
          <CopyButton value={address} label="Copy" />
          {href ? <ExternalLink href={href}>Explorer</ExternalLink> : null}
        </span>
      ) : (
        <span>Anyone with the link, except the seller and resolver</span>
      )}
    </div>
  );
}

export function DeadlineRow({ label, seconds, now }: { label: string; seconds?: number; now?: number }) {
  if (!seconds) return <div className="flex justify-between gap-3 text-sm"><span className="text-faint">{label}</span><span>Not set</span></div>;
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-faint">{label}</span>
      <span className="text-right">
        <span className="num block">{formatTimestamp(seconds)}</span>
        {now ? <span className="text-xs text-faint">{formatRelative(seconds, now)}</span> : null}
      </span>
    </div>
  );
}

export function AgreementCard({ model, now }: { model: EscrowModel; now?: number }) {
  const metadata = model.metadata;
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-faint">Protected MUSD checkout</p>
          <h2 className="mt-1 text-2xl font-semibold">{metadata?.title ?? `Agreement ${model.id.toString()}`}</h2>
          {metadata?.plan ? <p className="mt-1 text-sm text-brand">Milestone {metadata.plan.index} of {metadata.plan.count}: {metadata.plan.label}</p> : null}
        </div>
        <StatusBadge state={model.state} />
      </div>
      <p className="num display text-4xl leading-none">{formatMusd(model.amount)} <span className="font-sans text-lg font-medium tracking-normal text-muted">MUSD</span></p>
      <p className="text-sm text-muted">{FUNDS_DISCLOSURE}</p>
      <ProgressRail state={model.state} />
      {metadata ? (
        <div className="space-y-3 text-sm">
          <p>{metadata.description}</p>
          <div>
            <p className="text-faint">Terms</p>
            <p className="whitespace-pre-wrap">{metadata.terms}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-danger">Agreement details could not be verified against the on-chain hash.</p>
      )}
      <div className="space-y-2 border-t border-line pt-4">
        <PartyRow role="Seller" address={model.seller} />
        <PartyRow role="Buyer" address={model.buyer} />
        <PartyRow role="Resolver" address={model.resolver} />
        <DeadlineRow label="Funding deadline" seconds={model.fundingDeadline} now={now} />
        <DeadlineRow label="Delivery deadline" seconds={model.deliveryDeadline} now={now} />
        <DeadlineRow label="Review deadline" seconds={model.reviewDeadline || undefined} now={now} />
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-faint">Review window</span>
          <span className="num">{Math.round(model.reviewPeriod / 60)} minutes</span>
        </div>
      </div>
      <p className="text-sm text-muted">{RESOLVER_DISCLOSURE}</p>
      <p className="text-sm text-muted">{AUTO_RELEASE_DISCLOSURE}</p>
      <p className="text-sm text-faint">{NO_FEE_DISCLOSURE}</p>
      <p className="break-all text-xs text-faint">Metadata hash {model.metadataHash}</p>
      {model.evidence ? (
        <div className="rounded-xl border border-line bg-bg p-3 text-sm">
          <p className="font-medium">Delivery evidence</p>
          <p className="mt-2 whitespace-pre-wrap">{model.evidence.note}</p>
          {model.evidence.url && safeHttpsUrl(model.evidence.url) ? (
            <p className="mt-2"><ExternalLink href={model.evidence.url}>{model.evidence.url}</ExternalLink></p>
          ) : model.evidence.url ? <p className="mt-2 break-all text-warning">Unverified URL text: {model.evidence.url}</p> : null}
          <p className="mt-2 text-xs text-faint">{EVIDENCE_DISCLOSURE}</p>
          <p className="mt-1 break-all text-xs text-faint">{model.evidenceHash}</p>
        </div>
      ) : null}
    </Card>
  );
}

export function ActionPanel({
  panel,
  busy,
  onAction,
}: {
  panel: PanelModel;
  busy?: boolean;
  onAction: (id: ActionId) => void;
}) {
  return (
    <div className="space-y-3">
      {panel.notices.map((notice, index) => (
        <p key={`${notice}-${index}`} className="text-sm text-muted">{notice}</p>
      ))}
      {panel.primary ? (
        <>
          <Button className="w-full" busy={busy} variant={panel.primary.tone === "danger" ? "danger" : "primary"} onClick={() => onAction(panel.primary!.id)}>
            {panel.primary.label}
          </Button>
          <p className="text-sm text-faint">{panel.primary.description}</p>
        </>
      ) : null}
      {panel.secondary.map((action) => (
        <Button key={action.id} className="w-full" busy={busy} variant={action.tone === "danger" ? "danger" : "secondary"} onClick={() => onAction(action.id)}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

const TX_STEPS = ["Wallet", "Network", "Confirmed"] as const;

function txStep(phase: TxPhase["phase"]) {
  if (phase === "submitted" || phase === "confirming") return 1;
  if (phase === "confirmed") return 2;
  return 0;
}

export function TxStatus({ phase }: { phase: TxPhase }) {
  const active = phase.phase !== "idle";
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!active) {
      setDrawn(false);
      return;
    }
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [active]);
  if (!active) return null;
  const hash = "hash" in phase ? phase.hash : undefined;
  const href = explorerTxUrl(hash);
  const failed = phase.phase === "rejected" || phase.phase === "reverted" || phase.phase === "unknown";
  const current = txStep(phase.phase);
  const live = !failed && phase.phase !== "confirmed";
  const message = phase.phase === "awaiting_wallet"
    ? "Confirm the request in your wallet. Nothing is final until the network confirms it."
    : phase.phase === "submitted" || phase.phase === "confirming"
      ? "Your transaction was submitted but has not yet been confirmed."
      : phase.phase === "confirmed"
        ? "The transaction receipt succeeded."
        : "message" in phase
          ? phase.message
          : "Working…";
  const progress = drawn ? (current / (TX_STEPS.length - 1)) * 100 : 0;
  const style = { "--rail": `${progress}%`, "--rail-span": `${(TX_STEPS.length - 1) / TX_STEPS.length}`, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } as CSSProperties;
  return (
    <div aria-live="polite" className={cn("tx-status", failed && "is-fail", phase.phase === "confirmed" && "is-ok")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">{phase.action}</p>
        {live ? <span className="live-dot" aria-hidden /> : null}
      </div>
      {failed ? null : (
        <ol className={cn("rail mt-4", live && "is-live")} style={style} aria-label="Transaction progress">
          {TX_STEPS.map((label, index) => (
            <li key={label} aria-current={index === current ? "step" : undefined} className={cn("text-xs", index <= current ? "font-medium text-ink" : "text-faint", index < current && "is-done")}>
              <span className="rail-mark" aria-hidden />
              {label}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-sm font-medium">{message}</p>
      {hash ? (
        <p className="mt-2 break-all text-xs text-faint">
          {hash} {href ? <ExternalLink href={href}>View on explorer</ExternalLink> : null}
        </p>
      ) : null}
    </div>
  );
}

export function Timeline({
  events,
  loading,
  error,
  partial,
  onRetry,
}: {
  events?: ChainEvent[];
  loading?: boolean;
  error?: boolean;
  partial?: boolean;
  onRetry?: () => void;
}) {
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-16" />)}</div>;
  if (error) return <ErrorPanel title="Event history could not be loaded." detail="The current agreement state above still comes from a contract read." onRetry={onRetry} />;
  return (
    <div className="space-y-3">
      {partial ? <p className="text-sm text-faint">Older events may be outside this range.</p> : null}
      {!events || events.length === 0 ? <p className="text-sm text-muted">No events in this range.</p> : null}
      {events && events.length > 0 ? (
        <ol className="tx-feed">
          {events.map((event, index) => {
            const href = explorerTxUrl(event.transactionHash);
            return (
              <li
                key={`${event.transactionHash}-${event.name}-${event.blockNumber.toString()}`}
                className={cn("tx-feed-item enter", index === 0 && "is-latest")}
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <div className="tx-card !p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{describeEvent(event)}</p>
                    <span className="num text-xs text-faint">{event.timestamp ? formatTimestamp(event.timestamp) : `Block ${event.blockNumber.toString()}`}</span>
                  </div>
                  <p className="mt-1 break-all text-xs text-faint">
                    {event.transactionHash && event.transactionHash !== "0x" ? event.transactionHash : "Transaction hash unavailable"}
                    {href ? <> · <ExternalLink href={href}>View on explorer</ExternalLink></> : null}
                  </p>
                  {typeof event.args.reason === "string" ? <p className="mt-2 whitespace-pre-wrap">{event.args.reason}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

export function EscrowLinks({ id }: { id: bigint }) {
  const value = id.toString();
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <Link className="text-brand" href={`/checkout/${value}`}>Checkout</Link>
      <Link className="text-brand" href={`/escrows/${value}`}>Details</Link>
      <Link className="text-brand" href={`/receipt/${value}`}>Receipt</Link>
      <a className="text-brand" href={`/api/x402/agreements/${value}`}>Payment requirements</a>
    </div>
  );
}
