"use client";

import { useState } from "react";
import { getAddress, isAddress } from "viem";
import { useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { erc20Abi } from "@/lib/contracts/erc20";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { formatMusd, parseMusdInput, shortAddress, ZERO_ADDRESS } from "@/lib/escrow/format";
import { useProtocol } from "@/hooks/use-escrow";
import { useTrackedTx } from "@/hooks/use-tx";
import { TxStatus } from "@/components/escrow/views";
import { Button, Card, Field, controlClass } from "@/components/ui";
import Link from "next/link";
import type { TxPhase } from "@/lib/escrow/types";

function isBusy(phase: TxPhase, prefix: string) {
  const pending = phase.phase === "preparing" || phase.phase === "awaiting_wallet" || phase.phase === "submitted" || phase.phase === "confirming";
  return pending && phase.action.startsWith(prefix);
}

export function AgentBudgetPanel() {
  const protocol = useProtocol();
  const wallet = protocol.account.address;
  const escrow = protocol.escrow.address;
  const [agent, setAgent] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const tx = useTrackedTx();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();
  const parsed = amount.trim() ? parseMusdInput(amount) : undefined;
  const agentAddress = isAddress(agent) ? getAddress(agent) : undefined;
  const self = Boolean(wallet && agentAddress && agentAddress.toLowerCase() === wallet.toLowerCase());
  const probe = useReadContract({
    address: escrow,
    abi: relayEscrowAbi,
    functionName: "agentAllowance",
    args: [ZERO_ADDRESS, ZERO_ADDRESS],
    chainId: protocol.chain.id,
    query: { enabled: Boolean(escrow), retry: false },
  });
  const supported = probe.isSuccess;
  const current = useReadContract({
    address: escrow,
    abi: relayEscrowAbi,
    functionName: "agentAllowance",
    args: wallet && agentAddress ? [wallet, agentAddress] : undefined,
    chainId: protocol.chain.id,
    query: { enabled: Boolean(supported && escrow && wallet && agentAddress && !self), retry: false },
  });
  const approval = useReadContract({
    address: protocol.musd.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: wallet && escrow ? [wallet, escrow] : undefined,
    chainId: protocol.chain.id,
    query: { enabled: Boolean(protocol.musd.address && wallet && escrow) },
  });
  const budget = parsed?.ok ? parsed.amount : undefined;
  const approved = typeof approval.data === "bigint" ? approval.data : undefined;
  const needsApproval = budget !== undefined && approved !== undefined && approved < budget;
  const ready = Boolean(supported && escrow && wallet && protocol.chainMatches);

  async function approve() {
    if (!budget || !protocol.musd.address || !escrow || !wallet) return;
    const next = approved !== undefined && approved > budget ? approved : budget;
    await tx.run("Approve MUSD for agent funding", () => writeContractAsync({
      chainId: protocol.chain.id,
      address: protocol.musd.address!,
      abi: erc20Abi,
      functionName: "approve",
      args: [escrow, next],
    }), async () => {
      void approval.refetch();
    });
  }

  async function save() {
    if (!escrow || !wallet) return;
    if (!agentAddress || self) {
      setError("Enter an agent address that is not your own wallet.");
      return;
    }
    if (!parsed?.ok) {
      setError(parsed?.error ?? "Enter the budget in MUSD.");
      return;
    }
    setError("");
    await tx.run("Set agent budget", () => writeContractAsync({
      chainId: protocol.chain.id,
      address: escrow,
      abi: relayEscrowAbi,
      functionName: "setAgentAllowance",
      args: [agentAddress, parsed.amount],
    }), async () => {
      void current.refetch();
    });
  }

  return (
    <Card className="form-panel space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Agent spending budget</h2>
        <p className="mt-2 text-sm text-muted">Cap for another address. Zero revokes it. You stay the buyer.</p>
      </div>
      <Field label="Buyer">
        <input className={`${controlClass} num`} value={wallet ? shortAddress(wallet) : "Connect a wallet"} readOnly />
      </Field>
      <Field label="Agent wallet" error={self ? "Use a different address." : undefined}>
        <input className={`${controlClass} num`} value={agent} onChange={(event) => { setAgent(event.target.value.trim()); setError(""); }} placeholder="0x" disabled={!escrow} />
      </Field>
      <Field label="Remaining budget in MUSD" hint="Replaces the current cap." error={parsed && !parsed.ok ? parsed.error : undefined}>
        <input className={`${controlClass} num`} inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0.00" disabled={!escrow} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-[#163300] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">On-chain cap</p>
          <p className="num mt-1 text-lg font-semibold">
            {typeof current.data === "bigint" ? `${formatMusd(current.data)} MUSD` : "—"}
          </p>
        </div>
        <div className="rounded-2xl border-2 border-[#163300] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">MUSD approval</p>
          <p className="num mt-1 text-lg font-semibold">{approved === undefined ? "—" : `${formatMusd(approved)} MUSD`}</p>
        </div>
      </div>
      {!escrow ? <p className="text-sm text-warning">Escrow address missing.</p> : null}
      {escrow && probe.isPending ? <p className="text-sm text-muted">Checking this deployment.</p> : null}
      {escrow && probe.isError ? <p className="text-sm text-warning">This escrow has no agent-budget function, so the button stays off.</p> : null}
      {escrow && wallet && !protocol.chainMatches ? <Button onClick={() => switchChain({ chainId: protocol.chain.id })}>Switch to {protocol.chain.name}</Button> : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      <TxStatus phase={tx.phase} />
      <div className="flex flex-wrap gap-2">
        {needsApproval ? <Button disabled={!ready} busy={isBusy(tx.phase, "Approve")} onClick={() => void approve()}>Approve MUSD</Button> : null}
        <Button variant={needsApproval ? "secondary" : "primary"} disabled={!ready} busy={isBusy(tx.phase, "Set")} onClick={() => void save()}>Set budget</Button>
      </div>
    </Card>
  );
}

export function AgentsScreen() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Spending limits</p>
        <h1 className="display-title mt-1">Agent budgets</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Another address can fund your agreements, up to a cap.</p>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        <li className="rounded-[28px] border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">1</p>
          <h2 className="mt-2 font-semibold">Name the agent</h2>
          <p className="mt-2 text-sm text-muted">Only checkouts that name you as buyer.</p>
        </li>
        <li className="rounded-[28px] border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">2</p>
          <h2 className="mt-2 font-semibold">Set the remaining cap</h2>
          <p className="mt-2 text-sm text-muted">Each fund lowers the cap. Zero revokes it.</p>
        </li>
        <li className="rounded-[28px] border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">3</p>
          <h2 className="mt-2 font-semibold">The agent funds</h2>
          <p className="mt-2 text-sm text-muted">Uses your MUSD approval. <Link className="font-semibold text-brand" href="/create">Create the checkout first.</Link></p>
        </li>
      </ol>
      <AgentBudgetPanel />
    </div>
  );
}
