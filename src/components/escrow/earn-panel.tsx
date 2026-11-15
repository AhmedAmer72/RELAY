"use client";

import type { Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { erc20Abi } from "@/lib/contracts/erc20";
import { formatMusd } from "@/lib/escrow/format";
import { MEZO_TESTNET_SYSTEM } from "@/lib/mezo/system";
import { Card } from "@/components/ui";

const voterAbi = [
  { type: "function", name: "gauges", stateMutability: "view", inputs: [{ name: "pool", type: "address" }], outputs: [{ type: "address" }] },
] as const;

const TESTNET_VOTER = "0x72F8dd7F44fFa19E45955aa20A5486E8EB255738" as Address;

export function EarnPanel({ chainId, account }: { chainId: number; account?: Address }) {
  const enabled = Boolean(account);
  const reads = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: MEZO_TESTNET_SYSTEM.musdBtcPool, abi: erc20Abi, functionName: "balanceOf", args: account ? [account] : undefined, chainId },
      { address: TESTNET_VOTER, abi: voterAbi, functionName: "gauges", args: [MEZO_TESTNET_SYSTEM.musdBtcPool], chainId },
    ],
    query: { enabled },
  });
  const lp = reads.data?.[0]?.status === "success" && typeof reads.data[0].result === "bigint" ? reads.data[0].result : undefined;
  const gauge = reads.data?.[1]?.status === "success" && typeof reads.data[1].result === "string" ? reads.data[1].result : undefined;
  const gaugeAddress = gauge && gauge !== "0x0000000000000000000000000000000000000000" ? gauge as Address : undefined;
  const staked = useReadContract({
    address: gaugeAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(account && gaugeAddress) },
  });
  const stakedAmount = typeof staked.data === "bigint" ? staked.data : 0n;
  const hasPosition = (lp ?? 0n) > 0n || stakedAmount > 0n;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Mezo Earn</h2>
        <p className="mt-1 text-sm text-muted">LP and gauge balances are read from the testnet contracts. This is not a yield rate.</p>
      </div>
      <p className="text-sm">MUSD/BTC LP: <span className="num font-semibold">{lp === undefined ? "—" : formatMusd(lp)}</span></p>
      <p className="text-sm">Staked in the gauge: <span className="num font-semibold">{gaugeAddress ? formatMusd(stakedAmount) : "No gauge for this pool"}</span></p>
      <p className="text-sm text-muted">The savings vault was not found on testnet. No APR is shown.</p>
      {!hasPosition ? <p className="text-sm">No Earn position.</p> : null}
    </Card>
  );
}
