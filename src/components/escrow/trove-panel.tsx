"use client";

import { useState } from "react";
import { type Address, formatUnits, getAddress } from "viem";
import { usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { useTrackedTx } from "@/hooks/use-tx";
import { formatMusd } from "@/lib/escrow/format";
import { inRecoveryMode, liquidationPrice, oracleAllowsBorrow, planBorrow, RELAY_BORROW_FLOOR } from "@/lib/mezo/quote";
import {
  GAS_RESERVE,
  MEZO_TESTNET_SYSTEM,
  TROVE_ACTIVE,
  borrowerOperationsAbi,
  hintHelpersAbi,
  interestRateAbi,
  priceFeedAbi,
  skipOracleAbi,
  sortedTrovesAbi,
  troveManagerAbi,
  troveRiskAbi,
} from "@/lib/mezo/system";
import { Button, Card } from "@/components/ui";
import { TxStatus } from "@/components/escrow/views";

function percent(ratio?: bigint) {
  if (ratio === undefined) return "—";
  return `${(Number(ratio / 10n ** 14n) / 100).toFixed(2)}%`;
}

function btc(value?: bigint) {
  if (value === undefined) return "—";
  return `${Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC`;
}

function usd(price?: bigint) {
  if (price === undefined) return "—";
  return `$${Number(formatUnits(price, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function TroveBorrowPanel({
  chainId,
  account,
  shortfall,
  nativeBalance,
  chainMatches,
  onBorrowed,
}: {
  chainId: number;
  account?: Address;
  shortfall?: bigint;
  nativeBalance?: bigint;
  chainMatches: boolean;
  onBorrowed: () => Promise<void> | void;
}) {
  const client = usePublicClient({ chainId });
  const tx = useTrackedTx();
  const { writeContractAsync } = useWriteContract();
  const [localError, setLocalError] = useState<string>();
  const enabled = Boolean(account && chainMatches);
  const system = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: MEZO_TESTNET_SYSTEM.borrowerOperations, abi: borrowerOperationsAbi, functionName: "minNetDebt", chainId },
      { address: MEZO_TESTNET_SYSTEM.troveManager, abi: troveManagerAbi, functionName: "MUSD_GAS_COMPENSATION", chainId },
      { address: MEZO_TESTNET_SYSTEM.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice", chainId },
      { address: MEZO_TESTNET_SYSTEM.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: account ? [account] : undefined, chainId },
      { address: MEZO_TESTNET_SYSTEM.troveManager, abi: troveManagerAbi, functionName: "getTroveColl", args: account ? [account] : undefined, chainId },
      { address: MEZO_TESTNET_SYSTEM.troveManager, abi: troveManagerAbi, functionName: "getTroveDebt", args: account ? [account] : undefined, chainId },
    ],
    query: { enabled, refetchInterval: 20_000 },
  });
  const row = (index: number) => {
    const item = system.data?.[index];
    return item?.status === "success" ? item.result : undefined;
  };
  const asBigint = (value: unknown) => typeof value === "bigint" ? value : undefined;
  const minNetDebt = asBigint(row(0));
  const gasCompensation = asBigint(row(1));
  const price = asBigint(row(2));
  const status = typeof row(3) === "number" || typeof row(3) === "bigint" ? Number(row(3)) : undefined;
  const coll = asBigint(row(4)) ?? 0n;
  const debt = asBigint(row(5)) ?? 0n;
  const active = status === TROVE_ACTIVE;
  const targetNet = shortfall === undefined || minNetDebt === undefined
    ? undefined
    : !active && shortfall < minNetDebt ? minNetDebt : shortfall;
  const feeRead = useReadContract({
    address: MEZO_TESTNET_SYSTEM.borrowerOperations,
    abi: borrowerOperationsAbi,
    functionName: "getBorrowingFee",
    args: targetNet !== undefined ? [targetNet] : undefined,
    chainId,
    query: { enabled: Boolean(enabled && targetNet && targetNet > 0n) },
  });
  const plan = shortfall !== undefined && minNetDebt !== undefined && gasCompensation !== undefined && price !== undefined && nativeBalance !== undefined && typeof feeRead.data === "bigint"
    ? planBorrow({
        shortfall,
        minNetDebt,
        gasCompensation,
        borrowFee: feeRead.data,
        price,
        nativeBalance,
        active,
        coll,
        debt,
      })
    : undefined;
  const icrRead = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "getCurrentICR",
    args: account && price ? [account, price] : undefined,
    chainId,
    query: { enabled: Boolean(enabled && active && price) },
  });

  async function borrow() {
    if (!client || !account || !plan?.ok) return;
    setLocalError(undefined);
    const totalDebt = plan.totalDebt;
    const nicr = (plan.collateral + (active ? coll : 0n)) * 10n ** 20n / totalDebt;
    await tx.run(plan.mode === "open" ? "Open Mezo trove" : "Borrow MUSD from trove", async () => {
      const approx = await client.readContract({
        address: MEZO_TESTNET_SYSTEM.hintHelpers,
        abi: hintHelpersAbi,
        functionName: "getApproxHint",
        args: [nicr, 15n, 42n],
      });
      const hint = getAddress(approx[0]);
      const position = await client.readContract({
        address: MEZO_TESTNET_SYSTEM.sortedTroves,
        abi: sortedTrovesAbi,
        functionName: "findInsertPosition",
        args: [nicr, hint, hint],
      });
      const upper = position[0];
      const lower = position[1];
      if (plan.mode === "open") {
        return writeContractAsync({
          chainId,
          address: MEZO_TESTNET_SYSTEM.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: "openTrove",
          args: [plan.netMusd, upper, lower],
          value: plan.collateral,
        });
      }
      if (plan.mode === "adjust") {
        return writeContractAsync({
          chainId,
          address: MEZO_TESTNET_SYSTEM.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: "adjustTrove",
          args: [0n, plan.netMusd, true, upper, lower],
          value: plan.collateral,
        });
      }
      return writeContractAsync({
        chainId,
        address: MEZO_TESTNET_SYSTEM.borrowerOperations,
        abi: borrowerOperationsAbi,
        functionName: "withdrawMUSD",
        args: [plan.netMusd, upper, lower],
      });
    }, async () => {
      await onBorrowed();
      await system.refetch();
    });
  }

  const risk = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: MEZO_TESTNET_SYSTEM.troveManager, abi: troveRiskAbi, functionName: "MCR", chainId },
      { address: MEZO_TESTNET_SYSTEM.troveManager, abi: troveRiskAbi, functionName: "CCR", chainId },
      { address: MEZO_TESTNET_SYSTEM.troveManager, abi: troveRiskAbi, functionName: "getTCR", args: price ? [price] : undefined, chainId },
      { address: MEZO_TESTNET_SYSTEM.skipBtcUsd, abi: skipOracleAbi, functionName: "latestRoundData", chainId },
      { address: MEZO_TESTNET_SYSTEM.interestRateManager, abi: interestRateAbi, functionName: "interestRate", chainId },
    ],
    query: { enabled, refetchInterval: 20_000 },
  });
  const riskRow = (index: number) => {
    const item = risk.data?.[index];
    return item?.status === "success" ? item.result : undefined;
  };
  const mcr = asBigint(riskRow(0));
  const ccr = asBigint(riskRow(1));
  const tcr = asBigint(riskRow(2));
  const skipRound = Array.isArray(riskRow(3)) ? riskRow(3) as readonly bigint[] : undefined;
  const skipPrice = skipRound && skipRound[1] > 0n ? skipRound[1] : 0n;
  const skipUpdatedAt = skipRound?.[3] ?? 0n;
  const oracle = price !== undefined
    ? oracleAllowsBorrow({ feed: price, skip: skipPrice, updatedAt: skipUpdatedAt, now: BigInt(Math.floor(Date.now() / 1000)) })
    : undefined;
  const interest = typeof riskRow(4) === "number" || typeof riskRow(4) === "bigint" ? Number(riskRow(4)) : undefined;
  const recovery = inRecoveryMode(tcr, ccr);
  const currentRatio = typeof icrRead.data === "bigint" ? icrRead.data : undefined;
  const shownColl = active ? coll : plan?.collateral;
  const shownDebt = active ? debt : plan?.totalDebt;
  const liquidation = shownColl !== undefined && shownDebt !== undefined && mcr !== undefined
    ? liquidationPrice(shownColl, shownDebt, mcr)
    : undefined;
  const busy = tx.phase.phase === "awaiting_wallet" || tx.phase.phase === "confirming" || tx.phase.phase === "submitted";

  async function borrowIfFresh() {
    if (!oracle?.ok) {
      setLocalError(oracle?.reason ?? "The BTC price is not available.");
      return;
    }
    await borrow();
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Mezo trove</h2>
        <p className="mt-1 text-sm text-muted">Borrow MUSD against BTC through BorrowerOperations, then fund this agreement with the existing approval. These figures are read from Mezo. RELAY does not invent a price.</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-faint">BTC collateral</dt><dd className="num font-semibold">{btc(shownColl)}</dd></div>
        <div><dt className="text-faint">MUSD debt</dt><dd className="num font-semibold">{shownDebt === undefined ? "—" : `${formatMusd(shownDebt)} MUSD`}</dd></div>
        <div><dt className="text-faint">Current ratio</dt><dd className="num font-semibold">{percent(active ? currentRatio : undefined)}</dd></div>
        <div><dt className="text-faint">Projected ratio</dt><dd className="num font-semibold">{percent(plan?.ratio)}</dd></div>
        <div><dt className="text-faint">BTC price</dt><dd className="num font-semibold">{usd(price)}</dd></div>
        <div><dt className="text-faint">Liquidation price</dt><dd className="num font-semibold">{usd(liquidation)}</dd></div>
        <div><dt className="text-faint">Borrowing fee</dt><dd className="num font-semibold">{typeof feeRead.data === "bigint" ? `${formatMusd(feeRead.data)} MUSD` : "—"}</dd></div>
        <div><dt className="text-faint">Interest</dt><dd className="num font-semibold">{interest === undefined ? "The interest rate was not read." : `${(interest / 100).toFixed(2)}% per year`}</dd></div>
        <div><dt className="text-faint">Borrow</dt><dd className="num font-semibold">{plan ? `${formatMusd(plan.netMusd)} MUSD` : "—"}</dd></div>
      </dl>
      <p className="text-sm text-muted">Mezo liquidates below {percent(mcr)}. Recovery mode is when the system ratio is under {percent(ccr)}. It is {recovery === undefined ? "unread" : recovery ? "on" : "off"} at the current price. RELAY will not borrow if the result would fall under its own {percent(RELAY_BORROW_FLOOR)} floor{ccr === RELAY_BORROW_FLOOR ? ", which matches Mezo's recovery threshold today" : ""}.</p>
      {oracle && !oracle.ok ? <p className="text-sm text-warning">{oracle.reason}</p> : null}
      {shortfall === 0n ? <p className="text-sm text-muted">The MUSD balance covers this invoice. Borrow only if you still want a larger trove.</p> : null}
      {plan?.mode === "open" ? <p className="text-sm text-muted">A new trove must borrow at least the Mezo minimum, about {minNetDebt ? formatMusd(minNetDebt) : "—"} MUSD, not only this invoice.</p> : null}
      {plan && !plan.ok && plan.reason ? <p className="text-sm text-warning">{plan.reason}</p> : null}
      {localError ? <p className="text-sm text-danger">{localError}</p> : null}
      {nativeBalance !== undefined && nativeBalance <= GAS_RESERVE ? <p className="text-sm text-warning">Not enough BTC left for gas and collateral.</p> : null}
      <TxStatus phase={tx.phase} />
      <Button
        disabled={!plan?.ok || !oracle?.ok || !chainMatches || busy}
        onClick={() => void borrowIfFresh().catch((error: unknown) => setLocalError(error instanceof Error ? error.message : "The trove transaction failed."))}
      >
        {plan?.mode === "open" ? "Open trove and borrow" : "Borrow the shortfall"}
      </Button>
    </Card>
  );
}
