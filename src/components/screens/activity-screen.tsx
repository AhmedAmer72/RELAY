"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { describeEvent } from "@/lib/chain/logs";
import { escrowPath, explorerTxUrl, getEscrowConfig } from "@/lib/chain/config";
import { formatTimestamp } from "@/lib/escrow/time";
import { useChainEvents } from "@/hooks/use-escrow";
import { Button, CopyButton, EmptyState, ErrorPanel, ExternalLink, FilterChip, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "EscrowCreated", label: "Created" },
  { id: "EscrowFunded", label: "Funded" },
  { id: "DeliverySubmitted", label: "Delivered" },
  { id: "EscrowReleased", label: "Released" },
  { id: "EscrowRefunded", label: "Refunded" },
  { id: "DisputeRaised", label: "Disputed" },
] as const;

function shortHash(hash: string) {
  if (!hash || hash === "0x" || hash.length < 18) return hash || "Unavailable";
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export function ActivityScreen() {
  const escrow = getEscrowConfig();
  const events = useChainEvents();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [page, setPage] = useState(0);
  const items = (events.data?.items ?? []).filter((event) => filter === "all" || event.name === filter);
  const pageSize = 20;
  const visible = items.slice(page * pageSize, page * pageSize + pageSize);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Network</p>
          <h1 className="display-title mt-1">Activity</h1>
          <p className="mt-2 text-sm text-muted">On-chain events only.</p>
        </div>
        {events.isFetching && !events.isLoading ? (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-faint"><span className="live-dot" aria-hidden />Updating</span>
        ) : null}
      </div>
      <div className="rounded-[28px] border-2 border-[#163300] bg-[#f3f8ea] p-4">
        <p className="text-sm font-semibold" id="activity-filter-label">Show</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="activity-filter-label">
          {FILTERS.map((item) => (
            <FilterChip key={item.id} active={filter === item.id} onClick={() => { setFilter(item.id); setPage(0); }}>{item.label}</FilterChip>
          ))}
        </div>
      </div>
      {!escrow.address ? <ErrorPanel title="The escrow contract address is not configured." detail="Activity is not shown until a deployed contract is set. This is not an empty scan of the chain." /> : null}
      {escrow.address && events.isLoading ? <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 rounded-[28px]" />)}</div> : null}
      {escrow.address && events.isError ? <ErrorPanel title="Activity could not be loaded from the network." onRetry={() => void events.refetch()} /> : null}
      {escrow.address && !events.isLoading && !events.isError && items.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No events in this range." : "No events match this filter."}
          copy={filter === "all" ? "Create a checkout or widen the indexed block range with the deployment block setting." : "Try another filter. This does not mean the read failed."}
        />
      ) : null}
      {events.data?.partial ? <p className="text-sm text-faint">Older events may be outside this block range.</p> : null}
      {escrow.address && visible.length > 0 ? (
        <ol className="tx-feed activity-feed">
          {visible.map((event, index) => {
            const href = explorerTxUrl(event.transactionHash);
            const hash = event.transactionHash;
            const style = { animationDelay: `${Math.min(index, 8) * 45}ms` } as CSSProperties;
            const when = event.timestamp ? formatTimestamp(event.timestamp) : `Block ${event.blockNumber.toString()}`;
            return (
              <li key={`${hash}-${event.name}-${event.escrowId?.toString()}`} className={cn("tx-feed-item enter", page === 0 && index === 0 && "is-latest")} style={style}>
                <article className="tx-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-base font-semibold">{describeEvent(event)}</h2>
                    <time className="num text-sm font-medium text-ink" dateTime={event.timestamp ? new Date(event.timestamp * 1000).toISOString() : undefined}>{when}</time>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Agreement</dt>
                    <dd className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="num text-base font-semibold">{event.escrowId !== undefined ? `#${event.escrowId.toString()}` : "—"}</span>
                      {event.escrowId ? <Link className="font-semibold text-brand underline decoration-meadow decoration-2 underline-offset-4" href={escrowPath("escrows", event.escrowId, event.contractAddress)}>Open</Link> : null}
                    </dd>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Transaction</dt>
                    <dd className="flex flex-wrap items-center gap-3">
                      <code className="num rounded-xl border-2 border-[#163300] bg-[#f3f8ea] px-3 py-2 text-sm font-semibold text-ink" title={hash}>{shortHash(hash)}</code>
                      {hash && hash !== "0x" ? <CopyButton value={hash} label="Copy" /> : null}
                      {href ? <ExternalLink href={href}>View on explorer</ExternalLink> : null}
                    </dd>
                  </dl>
                </article>
              </li>
            );
          })}
        </ol>
      ) : null}
      {items.length > pageSize ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <span className="text-sm text-faint">Page {page + 1} of {pages}</span>
          <Button variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}
