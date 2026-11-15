"use client";

import { useState } from "react";
import { formatUnits, getAddress, type Address } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { TxStatus } from "@/components/escrow/views";
import { Button, Card, Field, controlClass } from "@/components/ui";
import { useTrackedTx } from "@/hooks/use-tx";
import { erc20Abi } from "@/lib/contracts/erc20";
import { formatMusd, parseMusdInput } from "@/lib/escrow/format";
import {
  MEZO_TESTNET_SYSTEM,
  MIN_ICR,
  TROVE_ACTIVE,
  borrowerOperationsAbi,
  hintHelpersAbi,
  priceFeedAbi,
  sortedTrovesAbi,
  troveManagerAbi,
} from "@/lib/mezo/system";

export function TroveRepayPanel({
  chainId,
  account,
  musd,
}: {
  chainId: number;
  account?: Address;
  musd?: Address;
}) {
  const tx = useTrackedTx();
  const client = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const borrower = MEZO_TESTNET_SYSTEM.borrowerOperations;
  const enabled = Boolean(account && musd);
  const status = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "getTroveStatus",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled },
  });
  const active = status.data === TROVE_ACTIVE;
  const debtRead = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "getTroveDebt",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: enabled && active },
  });
  const collRead = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "getTroveColl",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: enabled && active },
  });
  const minDebt = useReadContract({
    address: borrower,
    abi: borrowerOperationsAbi,
    functionName: "minNetDebt",
    chainId,
    query: { enabled: enabled && active },
  });
  const gasComp = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "MUSD_GAS_COMPENSATION",
    chainId,
    query: { enabled: enabled && active },
  });
  const price = useReadContract({
    address: MEZO_TESTNET_SYSTEM.priceFeed,
    abi: priceFeedAbi,
    functionName: "fetchPrice",
    chainId,
    query: { enabled: enabled && active },
  });
  const balance = useReadContract({
    address: musd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled },
  });
  const allowance = useReadContract({
    address: musd,
    abi: erc20Abi,
    functionName: "allowance",
    args: account ? [account, borrower] : undefined,
    chainId,
    query: { enabled },
  });
  const debt = typeof debtRead.data === "bigint" ? debtRead.data : undefined;
  const coll = typeof collRead.data === "bigint" ? collRead.data : undefined;
  const floor = typeof minDebt.data === "bigint" && typeof gasComp.data === "bigint" ? minDebt.data + gasComp.data : undefined;
  const maxRepay = debt !== undefined && floor !== undefined && debt > floor ? debt - floor : 0n;
  const parsed = amount.trim() ? parseMusdInput(amount) : undefined;
  const repayAmount = parsed?.ok ? parsed.amount : undefined;
  const musdBalance = typeof balance.data === "bigint" ? balance.data : undefined;
  const approved = typeof allowance.data === "bigint" ? allowance.data : 0n;
  const nextDebt = debt !== undefined && repayAmount !== undefined ? debt - repayAmount : undefined;
  const nextRatio = coll !== undefined && typeof price.data === "bigint" && nextDebt !== undefined && nextDebt > 0n
    ? (coll * price.data) / nextDebt
    : undefined;
  const canRepay = Boolean(
    active && repayAmount && repayAmount > 0n && repayAmount <= maxRepay && musdBalance !== undefined && repayAmount <= musdBalance && nextRatio !== undefined && nextRatio >= MIN_ICR,
  );
  const canClose = Boolean(active && debt !== undefined && musdBalance !== undefined && musdBalance >= debt && debt > 0n);
  const pending = tx.phase.phase === "awaiting_wallet" || tx.phase.phase === "submitted" || tx.phase.phase === "confirming" || tx.phase.phase === "preparing";

  async function hints(nextColl: bigint, nextDebtValue: bigint) {
    if (!client) throw new Error("The network client is unavailable.");
    const nicr = nextColl * 10n ** 20n / nextDebtValue;
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
    return { upper: position[0], lower: position[1] };
  }

  async function approve(value: bigint) {
    if (!musd) return;
    await tx.run("Approve MUSD for trove repayment", () => writeContractAsync({
      chainId,
      address: musd,
      abi: erc20Abi,
      functionName: "approve",
      args: [borrower, value],
    }), async () => {
      await allowance.refetch();
    });
  }

  async function repay() {
    if (!account || !canRepay || repayAmount === undefined || coll === undefined || nextDebt === undefined) return;
    setError(undefined);
    if (approved < repayAmount) {
      await approve(repayAmount);
      return;
    }
    const position = await hints(coll, nextDebt);
    await tx.run("Repay MUSD to trove", () => writeContractAsync({
      chainId,
      address: borrower,
      abi: borrowerOperationsAbi,
      functionName: "repayMUSD",
      args: [repayAmount, position.upper, position.lower],
    }), async () => {
      await Promise.all([debtRead.refetch(), balance.refetch(), allowance.refetch()]);
    });
  }

  async function close() {
    if (!account || !canClose || debt === undefined || !musd) return;
    setError(undefined);
    if (approved < debt) {
      await approve(debt);
      return;
    }
    await tx.run("Close Mezo trove", () => writeContractAsync({
      chainId,
      address: borrower,
      abi: borrowerOperationsAbi,
      functionName: "closeTrove",
    }), async () => {
      await Promise.all([status.refetch(), balance.refetch()]);
    });
  }

  if (!active) return null;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Repay the trove</h2>
        <p className="mt-1 text-sm text-muted">Send MUSD back to your own Mezo trove. This does not move the escrow balance.</p>
      </div>
      <p className="text-sm">Debt: <span className="num font-semibold">{debt === undefined ? "—" : `${formatMusd(debt)} MUSD`}</span></p>
      <p className="text-sm">Collateral: <span className="num font-semibold">{coll === undefined ? "—" : `${formatUnits(coll, 18)} BTC`}</span></p>
      <p className="text-sm text-muted">A partial repay must leave at least the minimum debt. Closing the trove repays it in full and returns the BTC.</p>
      {nextRatio !== undefined ? <p className="text-sm">Collateral ratio after this repay: <span className="num font-semibold">{(Number(nextRatio) / 1e16).toFixed(2)}%</span></p> : null}
      <Field label="Repay amount in MUSD" error={parsed && !parsed.ok ? parsed.error : repayAmount !== undefined && repayAmount > maxRepay ? "That would leave the trove below Mezo's minimum debt. Close it instead." : undefined}>
        <input className={`${controlClass} num`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <TxStatus phase={tx.phase} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canRepay || pending} onClick={() => void repay().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The repayment failed."))}>
          {repayAmount !== undefined && approved < repayAmount ? "Approve repayment" : "Repay MUSD"}
        </Button>
        <Button variant="secondary" disabled={!canClose || pending} onClick={() => void close().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The trove could not be closed."))}>
          {debt !== undefined && approved < debt ? "Approve close" : "Close trove"}
        </Button>
      </div>
    </Card>
  );
}
