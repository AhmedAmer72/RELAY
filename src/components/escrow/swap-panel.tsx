"use client";

import { useState } from "react";
import { type Address, formatUnits } from "viem";
import { usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { TxStatus } from "@/components/escrow/views";
import { Button, Card } from "@/components/ui";
import { useTrackedTx } from "@/hooks/use-tx";
import { VERIFIED_TESTNET } from "@/lib/chain/config";
import { erc20Abi } from "@/lib/contracts/erc20";
import { formatMusd } from "@/lib/escrow/format";
import { btcToMusdRoute, minimumOut, poolMatchesMusdBtc, suggestBtcIn, SWAP_DEADLINE_SECONDS } from "@/lib/mezo/pool";
import { MEZO_TESTNET_SYSTEM, poolPairAbi, poolRouterAbi } from "@/lib/mezo/system";

export function SwapToMusdPanel({
  chainId,
  account,
  musd,
  shortfall,
  musdBalance,
  chainMatches,
  onSwapped,
}: {
  chainId: number;
  account?: Address;
  musd?: Address;
  shortfall?: bigint;
  musdBalance?: bigint;
  chainMatches: boolean;
  onSwapped: () => Promise<void> | void;
}) {
  const client = usePublicClient({ chainId });
  const tx = useTrackedTx();
  const { writeContractAsync } = useWriteContract();
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const enabled = Boolean(account && chainMatches && musd);
  const pool = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: MEZO_TESTNET_SYSTEM.musdBtcPool, abi: poolPairAbi, functionName: "token0", chainId },
      { address: MEZO_TESTNET_SYSTEM.musdBtcPool, abi: poolPairAbi, functionName: "token1", chainId },
      { address: MEZO_TESTNET_SYSTEM.musdBtcPool, abi: poolPairAbi, functionName: "getReserves", chainId },
      { address: MEZO_TESTNET_SYSTEM.btcToken, abi: erc20Abi, functionName: "decimals", chainId },
      { address: musd, abi: erc20Abi, functionName: "decimals", chainId },
    ],
    query: { enabled },
  });
  const row = (index: number) => {
    const item = pool.data?.[index];
    return item?.status === "success" ? item.result : undefined;
  };
  const token0 = typeof row(0) === "string" ? row(0) as Address : undefined;
  const token1 = typeof row(1) === "string" ? row(1) as Address : undefined;
  const reserves = Array.isArray(row(2)) ? row(2) as readonly bigint[] : undefined;
  const btcDecimals = typeof row(3) === "number" ? row(3) : undefined;
  const musdDecimals = typeof row(4) === "number" ? row(4) : undefined;
  const routeReady = poolMatchesMusdBtc(token0, token1)
    && reserves !== undefined
    && reserves[0] > 0n
    && reserves[1] > 0n
    && btcDecimals === 18
    && musdDecimals === 18;
  const reserveMusd = token0 && reserves
    ? (token0.toLowerCase() === VERIFIED_TESTNET.musd.toLowerCase() ? reserves[0] : reserves[1])
    : undefined;
  const reserveBtc = token0 && reserves
    ? (token0.toLowerCase() === VERIFIED_TESTNET.musd.toLowerCase() ? reserves[1] : reserves[0])
    : undefined;
  const amountIn = routeReady && shortfall && reserveMusd !== undefined && reserveBtc !== undefined
    ? suggestBtcIn(shortfall, reserveMusd, reserveBtc)
    : undefined;
  const route = btcToMusdRoute();
  const quote = useReadContract({
    address: MEZO_TESTNET_SYSTEM.basicRouter,
    abi: poolRouterAbi,
    functionName: "getAmountsOut",
    args: amountIn ? [amountIn, [route]] : undefined,
    chainId,
    query: { enabled: Boolean(enabled && amountIn) },
  });
  const quotedOut = Array.isArray(quote.data) ? quote.data[1] : undefined;
  const minOut = typeof quotedOut === "bigint" ? minimumOut(quotedOut) : undefined;
  const btcBalance = useReadContract({
    address: MEZO_TESTNET_SYSTEM.btcToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(account && routeReady) },
  });
  const allowance = useReadContract({
    address: MEZO_TESTNET_SYSTEM.btcToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: account ? [account, MEZO_TESTNET_SYSTEM.basicRouter] : undefined,
    chainId,
    query: { enabled: Boolean(account && routeReady) },
  });
  const held = typeof btcBalance.data === "bigint" ? btcBalance.data : undefined;
  const approved = typeof allowance.data === "bigint" ? allowance.data : 0n;
  const busy = tx.phase.phase === "awaiting_wallet" || tx.phase.phase === "submitted" || tx.phase.phase === "confirming";
  const canSwap = Boolean(routeReady && account && amountIn && minOut && minOut >= 1n && held !== undefined && held >= amountIn && chainMatches);

  async function swap() {
    if (!client || !account || !amountIn || !minOut || minOut < 1n) return;
    setError(undefined);
    setNote(undefined);
    const before = musdBalance ?? 0n;
    if (approved < amountIn) {
      await tx.run("Approve Mezo pool router", () => writeContractAsync({
        chainId,
        address: MEZO_TESTNET_SYSTEM.btcToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [MEZO_TESTNET_SYSTEM.basicRouter, amountIn],
      }), async () => {
        await allowance.refetch();
      });
      return;
    }
    const block = await client.getBlock();
    const deadline = block.timestamp + SWAP_DEADLINE_SECONDS;
    await tx.run("Swap BTC for MUSD", () => writeContractAsync({
      chainId,
      address: MEZO_TESTNET_SYSTEM.basicRouter,
      abi: poolRouterAbi,
      functionName: "swapExactTokensForTokens",
      args: [amountIn, minOut, [route], account, deadline],
    }), async () => {
      await onSwapped();
      await btcBalance.refetch();
    });
    setNote(`The swap receipt succeeded. Funding is a separate transaction. The MUSD balance before this swap was ${formatMusd(before)} MUSD. If funding does not go through, use the balance now shown above.`);
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Swap to MUSD</h2>
        <p className="mt-1 text-sm text-muted">Swap Mezo BTC for MUSD in the testnet basic pool, then fund this agreement. The swap does not call the escrow.</p>
      </div>
      {!routeReady ? <p className="text-sm text-warning">This swap is off. The testnet MUSD/BTC pool did not return the expected tokens, 18 decimals, and reserves.</p> : null}
      {routeReady && amountIn === undefined ? <p className="text-sm text-warning">The pool cannot quote this shortfall.</p> : null}
      {routeReady && amountIn && minOut === undefined && !quote.isLoading ? <p className="text-sm text-warning">The router did not return a quote with a minimum output above zero.</p> : null}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-faint">BTC in</dt><dd className="num font-semibold">{amountIn ? `${Number(formatUnits(amountIn, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC` : "—"}</dd></div>
        <div><dt className="text-faint">Quoted MUSD</dt><dd className="num font-semibold">{typeof quotedOut === "bigint" ? `${formatMusd(quotedOut)} MUSD` : "—"}</dd></div>
        <div><dt className="text-faint">Minimum out</dt><dd className="num font-semibold">{minOut ? `${formatMusd(minOut)} MUSD` : "—"}</dd></div>
        <div><dt className="text-faint">BTC token balance</dt><dd className="num font-semibold">{held === undefined ? "—" : `${Number(formatUnits(held, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC`}</dd></div>
      </dl>
      <p className="text-sm text-muted">Slippage is 0.50%. The transaction deadline is 20 minutes. A zero minimum is not sent.</p>
      {held !== undefined && amountIn !== undefined && held < amountIn ? <p className="text-sm text-warning">The BTC token balance is below the quoted input. Gas BTC and the BTC token are checked separately.</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {note ? <p className="text-sm text-brand">{note}</p> : null}
      <TxStatus phase={tx.phase} />
      <Button
        disabled={!canSwap || busy || (amountIn !== undefined && approved >= amountIn && minOut === undefined)}
        onClick={() => void swap().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The swap failed."))}
      >
        {amountIn && approved < amountIn ? "Approve BTC for the swap" : "Swap to MUSD"}
      </Button>
    </Card>
  );
}
