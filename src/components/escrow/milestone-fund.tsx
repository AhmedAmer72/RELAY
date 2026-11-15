"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useConfig, usePublicClient, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Button } from "@/components/ui";
import { erc20Abi } from "@/lib/contracts/erc20";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { formatMusd, isZeroAddress, sameAddress } from "@/lib/escrow/format";
import { coerceRawEscrow, parseEscrow } from "@/lib/escrow/parse";

export function MilestoneFundSequence({
  ids,
  escrow,
  chainId,
  musd,
  account,
}: {
  ids: bigint[];
  escrow?: Address;
  chainId: number;
  musd?: Address;
  account?: Address;
}) {
  const client = usePublicClient({ chainId });
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [progress, setProgress] = useState<string>();
  const [funded, setFunded] = useState<bigint[]>([]);
  const [stopped, setStopped] = useState<string>();

  async function fundAll() {
    if (!client || !escrow || !musd || !account) return;
    setStopped(undefined);
    const confirmed: bigint[] = [];
    try {
      const rows = [];
      for (const id of ids) {
        const raw = await client.readContract({ address: escrow, abi: relayEscrowAbi, functionName: "getEscrow", args: [id] });
        rows.push(parseEscrow(id, coerceRawEscrow(raw)));
      }
      const open = [];
      for (const row of rows) {
        if (row.state !== "Created" || !(isZeroAddress(row.buyer) || sameAddress(row.buyer, account)) || sameAddress(row.seller, account) || sameAddress(row.resolver, account)) continue;
        try {
          const predecessor = await client.readContract({ address: escrow, abi: relayEscrowAbi, functionName: "predecessorOf", args: [row.id] });
          if (predecessor > 0n) {
            const prior = parseEscrow(predecessor, coerceRawEscrow(await client.readContract({ address: escrow, abi: relayEscrowAbi, functionName: "getEscrow", args: [predecessor] })));
            if (prior.state !== "Released") throw new Error(`Agreement ${row.id.toString()} waits until agreement ${predecessor.toString()} is released.`);
          }
          if (!isZeroAddress(row.buyer)) {
            const accepted = await client.readContract({ address: escrow, abi: relayEscrowAbi, functionName: "resolverAccepted", args: [row.id] });
            if (!accepted) throw new Error(`Agreement ${row.id.toString()} needs the buyer to accept the resolver first.`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("waits until") || message.includes("accept the resolver")) throw error;
        }
        open.push(row);
      }
      if (open.length === 0) {
        setStopped("This wallet cannot fund these agreements. The named buyer can open this page and fund them in order.");
        return;
      }
      const total = open.reduce((sum, row) => sum + row.amount, 0n);
      const allowance = await client.readContract({ address: musd, abi: erc20Abi, functionName: "allowance", args: [account, escrow] });
      if (allowance < total) {
        setProgress(`Approve ${formatMusd(total)} MUSD for all remaining stages.`);
        const hash = await writeContractAsync({ chainId, address: musd, abi: erc20Abi, functionName: "approve", args: [escrow, total] });
        const receipt = await waitForTransactionReceipt(config, { hash, timeout: 120_000 });
        if (receipt.status !== "success") throw new Error("The approval was not confirmed.");
      }
      for (const row of open) {
        setProgress(`Funding agreement ${row.id.toString()} of the plan. Confirm it in your wallet.`);
        const hash = await writeContractAsync({ chainId, address: escrow, abi: relayEscrowAbi, functionName: "fundEscrow", args: [row.id] });
        const receipt = await waitForTransactionReceipt(config, { hash, timeout: 120_000 });
        if (receipt.status !== "success") throw new Error(`Agreement ${row.id.toString()} was not confirmed.`);
        const fresh = parseEscrow(row.id, coerceRawEscrow(await client.readContract({ address: escrow, abi: relayEscrowAbi, functionName: "getEscrow", args: [row.id] })));
        if (fresh.state !== "Funded") throw new Error(`Agreement ${row.id.toString()} was confirmed, but it is not funded.`);
        confirmed.push(row.id);
        setFunded([...confirmed]);
      }
      setProgress(undefined);
    } catch (error) {
      setProgress(undefined);
      setFunded(confirmed);
      setStopped(error instanceof Error ? error.message : "Funding stopped. Check the explorer before trying again.");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-sm">
      <p className="font-semibold">Fund these stages in order</p>
      <p className="mt-1 text-muted">One approval covers the total. Each agreement is funded only after the previous receipt succeeds.</p>
      {funded.length > 0 ? <p className="mt-2 text-brand">Funded: {funded.map((id) => id.toString()).join(", ")}</p> : null}
      {progress ? <p className="mt-2 text-brand">{progress}</p> : null}
      {stopped ? <p className="mt-2 text-warning">{stopped}</p> : null}
      <Button className="mt-3" disabled={!escrow || !musd || !account || Boolean(progress)} onClick={() => void fundAll()}>Fund milestone plan</Button>
    </div>
  );
}
