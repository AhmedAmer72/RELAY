"use client";

import Link from "next/link";
import { isAddress } from "viem";
import { escrowPath } from "@/lib/chain/config";
import { formatMusd, sameAddress, shortAddress } from "@/lib/escrow/format";
import { useRecentEscrows } from "@/hooks/use-escrow";
import { StatusBadge } from "@/components/escrow/views";
import { Card, EmptyState, ErrorPanel, Skeleton } from "@/components/ui";

export function SellerScreen({ address }: { address: string }) {
  const list = useRecentEscrows(1000);
  if (!isAddress(address)) {
    return <ErrorPanel title="That seller address is not valid." detail="Open a seller profile from an agreement page." />;
  }
  const seller = address;
  const agreements = list.models.filter((escrow) => sameAddress(escrow.seller, seller));
  const completed = agreements.filter((escrow) => escrow.state === "Released" || escrow.state === "Split");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-faint">Seller</p>
        <h1 className="display-title mt-1 break-all">{shortAddress(seller)}</h1>
        <p className="mt-2 text-sm text-muted">From the contract. No rating.</p>
      </div>
      {list.isLoading ? <Skeleton className="h-40" /> : null}
      {list.isError ? <ErrorPanel title="Seller history could not be read from the contract." onRetry={() => void list.refetch()} /> : null}
      {!list.isLoading && !list.isError ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card><p className="text-xs text-faint">Agreements found</p><p className="num display mt-2 text-3xl">{agreements.length}</p></Card>
            <Card><p className="text-xs text-faint">Paid to this seller</p><p className="num display mt-2 text-3xl">{completed.length}</p></Card>
          </div>
          {list.truncated ? <p className="text-sm text-faint">Most recent agreements only.</p> : null}
          {agreements.length === 0 ? <EmptyState title="No agreements for this seller were found." copy="The list comes from agreements stored on the escrow contract." /> : null}
          <div className="space-y-3">
            {agreements.map((escrow) => (
              <Card key={`${escrow.contractAddress}-${escrow.id.toString()}`} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{escrow.metadata?.title ?? `Agreement ${escrow.id.toString()}`}</p>
                  {escrow.metadata?.plan ? <p className="text-sm text-brand">Milestone {escrow.metadata.plan.index} of {escrow.metadata.plan.count}</p> : null}
                  <p className="num mt-1 text-sm">{formatMusd(escrow.amount)} MUSD</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge state={escrow.state} />
                  <Link className="text-sm text-brand" href={escrowPath("receipt", escrow.id, escrow.contractAddress)}>Receipt</Link>
                  <Link className="text-sm text-brand" href={escrowPath("checkout", escrow.id, escrow.contractAddress)}>Checkout</Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
