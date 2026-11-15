"use client";

import { useQuery } from "@tanstack/react-query";
import { formatMusd } from "@/lib/escrow/format";
import { VERIFIED_TESTNET } from "@/lib/chain/config";
import { useReadContract } from "wagmi";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { useProtocol } from "@/hooks/use-escrow";
import { Card, ErrorPanel, Skeleton } from "@/components/ui";

const FIRST_FEE_BLOCK = 16652687n;

type ActivityBody = {
  items: { name: string; args: Record<string, string | boolean>; blockNumber: string; transactionHash: string }[];
  caughtUp: boolean;
  indexing: boolean;
  error?: string;
  to?: string;
};

export function FeesScreen() {
  const protocol = useProtocol();
  const fee = useReadContract({
    address: protocol.escrow.address,
    abi: relayEscrowAbi,
    functionName: "feeBps",
    chainId: protocol.chain.id,
    query: { enabled: Boolean(protocol.escrow.address), retry: false },
  });
  const recipient = useReadContract({
    address: protocol.escrow.address,
    abi: relayEscrowAbi,
    functionName: "feeRecipient",
    chainId: protocol.chain.id,
    query: { enabled: Boolean(protocol.escrow.address), retry: false },
  });
  const events = useQuery({
    queryKey: ["fee-index"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const response = await fetch("/api/activity?name=ProtocolFeePaid");
      if (!response.ok) throw new Error("Fees could not be read.");
      const body = await response.json() as ActivityBody;
      if (body.error) throw new Error(body.error);
      return body;
    },
  });
  const reachedFees = events.data?.caughtUp || (events.data?.to !== undefined && BigInt(events.data.to) >= FIRST_FEE_BLOCK);
  const paid = (events.data?.items ?? []).filter((event) => event.name === "ProtocolFeePaid");
  const total = paid.reduce((sum, event) => sum + (typeof event.args.amount === "string" ? BigInt(event.args.amount) : 0n), 0n);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Protocol</p>
        <h1 className="display-title mt-1">Seller fees</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">The current escrow charges {typeof fee.data === "bigint" ? `${(Number(fee.data) / 100).toFixed(2)}%` : "0.50%"} when the seller is paid. Refunds are whole. Older escrows charge nothing.</p>
      </div>
      <Card className="space-y-2">
        <p className="text-sm">Fee recipient: <span className="num">{typeof recipient.data === "string" ? recipient.data : "—"}</span></p>
        <p className="text-sm">Current escrow: <span className="num">{protocol.escrow.address ?? VERIFIED_TESTNET.escrow}</span></p>
      </Card>
      {events.isLoading ? <Skeleton className="h-28" /> : null}
      {events.isError ? <ErrorPanel title="Fees could not be read from the index." detail={events.error instanceof Error ? events.error.message : "The scan failed. This is not a zero total."} onRetry={() => void fetch("/api/activity?retry=1").then(() => events.refetch())} /> : null}
      {events.data && !reachedFees ? <p className="text-sm text-muted">The index has not reached the first fee yet, so no total is shown.</p> : null}
      {events.data && reachedFees ? (
        <Card>
          <p className="text-sm text-muted">{events.data.caughtUp ? "Indexed seller fees" : "Indexed so far. The scan has not reached the latest block."}</p>
          <p className="num mt-2 text-3xl font-semibold">{formatMusd(total)} MUSD</p>
          <p className="mt-2 text-sm text-muted">{paid.length} fee payment{paid.length === 1 ? "" : "s"} in the loaded index.</p>
        </Card>
      ) : null}
    </div>
  );
}
