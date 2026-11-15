"use client";

import Link from "next/link";
import { escrowPath } from "@/lib/chain/config";
import { formatMusd, isZeroAddress } from "@/lib/escrow/format";
import { useRecentEscrows } from "@/hooks/use-escrow";
import { Card, EmptyState, ErrorPanel, Skeleton } from "@/components/ui";

export function OpenInvoicesScreen() {
  const list = useRecentEscrows(1000);
  const open = list.models.filter((escrow) => escrow.state === "Created" && isZeroAddress(escrow.buyer));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-faint">Open invoices</p>
        <h1 className="display-title mt-1">Anyone can fund</h1>
        <p className="mt-2 text-sm text-muted">Agreements with no buyer yet. The first allowed funder becomes the buyer.</p>
      </div>
      {list.isLoading ? <Skeleton className="h-40" /> : null}
      {list.isError ? <ErrorPanel title="Open invoices could not be read from the contract." onRetry={() => void list.refetch()} /> : null}
      {!list.isLoading && !list.isError && list.truncated ? <p className="text-sm text-faint">This list covers only the loaded agreements, not the full history.</p> : null}
      {!list.isLoading && !list.isError && open.length === 0 ? <EmptyState title="No open invoices were found." copy="A seller can leave the buyer blank when creating an agreement." /> : null}
      <div className="space-y-3">
        {open.map((escrow) => (
          <Card key={`${escrow.contractAddress}-${escrow.id.toString()}`} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{escrow.metadata?.title ?? `Agreement ${escrow.id.toString()}`}</p>
              <p className="num mt-1 text-sm">{formatMusd(escrow.amount)} MUSD</p>
            </div>
            <Link className="text-sm font-semibold text-brand" href={escrowPath("checkout", escrow.id, escrow.contractAddress)}>Open checkout</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
