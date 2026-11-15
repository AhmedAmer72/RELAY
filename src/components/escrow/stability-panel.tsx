"use client";

import { useState } from "react";
import { formatUnits, getAddress, type Address } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { TxStatus } from "@/components/escrow/views";
import { Button, Card } from "@/components/ui";
import { useTrackedTx } from "@/hooks/use-tx";
import { erc20Abi } from "@/lib/contracts/erc20";
import { formatMusd } from "@/lib/escrow/format";
import { MEZO_TESTNET_SYSTEM, TROVE_ACTIVE, hintHelpersAbi, sortedTrovesAbi, stabilityPoolAbi, troveManagerAbi } from "@/lib/mezo/system";

export function StabilityPanel({
  chainId,
  account,
  musd,
  amount,
}: {
  chainId: number;
  account?: Address;
  musd?: Address;
  amount: bigint;
}) {
  const tx = useTrackedTx();
  const client = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const [error, setError] = useState<string>();
  const pool = MEZO_TESTNET_SYSTEM.stabilityPool;
  const deposit = useReadContract({
    address: pool,
    abi: stabilityPoolAbi,
    functionName: "getCompoundedMUSDDeposit",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(account) },
  });
  const allowance = useReadContract({
    address: musd,
    abi: erc20Abi,
    functionName: "allowance",
    args: account ? [account, pool] : undefined,
    chainId,
    query: { enabled: Boolean(account && musd) },
  });
  const approved = typeof allowance.data === "bigint" ? allowance.data : 0n;
  const parked = typeof deposit.data === "bigint" ? deposit.data : undefined;
  const gainRead = useReadContract({
    address: pool,
    abi: stabilityPoolAbi,
    functionName: "getDepositorCollateralGain",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(account) },
  });
  const troveStatus = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "getTroveStatus",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(account) },
  });
  const troveColl = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "getTroveColl",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(account && troveStatus.data === TROVE_ACTIVE) },
  });
  const troveDebt = useReadContract({
    address: MEZO_TESTNET_SYSTEM.troveManager,
    abi: troveManagerAbi,
    functionName: "getTroveDebt",
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: Boolean(account && troveStatus.data === TROVE_ACTIVE) },
  });
  const gain = typeof gainRead.data === "bigint" ? gainRead.data : undefined;

  async function park() {
    if (!account || !musd || amount <= 0n) return;
    setError(undefined);
    if (approved < amount) {
      await tx.run("Approve Stability Pool", () => writeContractAsync({
        chainId,
        address: musd,
        abi: erc20Abi,
        functionName: "approve",
        args: [pool, amount],
      }), async () => {
        await allowance.refetch();
      });
      return;
    }
    await tx.run("Deposit MUSD in Stability Pool", () => writeContractAsync({
      chainId,
      address: pool,
      abi: stabilityPoolAbi,
      functionName: "provideToSP",
      args: [amount],
    }), async () => {
      await deposit.refetch();
    });
  }

  const pending = tx.phase.phase === "awaiting_wallet" || tx.phase.phase === "submitted" || tx.phase.phase === "confirming";

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Merchant reserve</h2>
        <p className="mt-1 text-sm text-muted">Park the seller payout in Mezo’s Stability Pool. This does not move the escrow balance.</p>
      </div>
      <p className="text-sm">Deposit: <span className="num font-semibold">{formatMusd(amount)} MUSD</span></p>
      <p className="text-sm text-muted">Already in the pool: <span className="num">{parked === undefined ? "—" : `${formatMusd(parked)} MUSD`}</span></p>
      <p className="text-sm text-muted">BTC gained from liquidations: <span className="num">{gain === undefined ? "—" : `${formatUnits(gain, 18)} BTC`}</span></p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <TxStatus phase={tx.phase} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!account || !musd || amount <= 0n || pending} onClick={() => void park().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The deposit failed."))}>
          {approved < amount ? "Approve Stability Pool" : "Deposit in Stability Pool"}
        </Button>
        <Button
          variant="secondary"
          disabled={!account || parked === undefined || parked <= 0n || pending}
          onClick={() => {
            if (!account || parked === undefined || parked <= 0n) return;
            setError(undefined);
            void tx.run("Withdraw MUSD from Stability Pool", () => writeContractAsync({
              chainId,
              address: pool,
              abi: stabilityPoolAbi,
              functionName: "withdrawFromSP",
              args: [parked],
            }), async () => {
              await deposit.refetch();
            }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The withdrawal failed."));
          }}
        >
          {parked !== undefined && parked > 0n ? `Withdraw ${formatMusd(parked)} MUSD` : "Withdraw from Stability Pool"}
        </Button>
        <Button
          variant="secondary"
          disabled={!account || gain === undefined || gain <= 0n || troveStatus.data !== TROVE_ACTIVE || pending}
          onClick={() => {
            if (!account || !client || gain === undefined || gain <= 0n || typeof troveColl.data !== "bigint" || typeof troveDebt.data !== "bigint" || troveDebt.data === 0n) return;
            setError(undefined);
            void (async () => {
              const nicr = (troveColl.data + gain) * 10n ** 20n / troveDebt.data;
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
              await tx.run("Move BTC gain into trove", () => writeContractAsync({
                chainId,
                address: pool,
                abi: stabilityPoolAbi,
                functionName: "withdrawCollateralGainToTrove",
                args: [position[0], position[1]],
              }), async () => {
                await Promise.all([gainRead.refetch(), troveColl.refetch()]);
              });
            })().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The collateral gain could not be moved."));
          }}
        >
          Move BTC gain into trove
        </Button>
      </div>
    </Card>
  );
}
