"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits, type Hex } from "viem";
import { useConnect, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { explorerAddressUrl, escrowPath } from "@/lib/chain/config";
import type { Address } from "viem";
import { erc20Abi } from "@/lib/contracts/erc20";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { AUTO_RELEASE_DISCLOSURE, NO_FEE_DISCLOSURE, RESOLVER_DISCLOSURE } from "@/lib/escrow/constants";
import { formatBaseUnits, formatMusd, isZeroAddress, parseMusdInput, sameAddress, shortAddress } from "@/lib/escrow/format";
import { coerceRawEscrow, parseEscrow } from "@/lib/escrow/parse";
import type { ActionId, EscrowState } from "@/lib/escrow/types";
import { validateEvidence, validateReason } from "@/lib/validation/actions";
import { evaluateEscrow } from "@/lib/escrow/policy";
import { panelFor, useChainEvents, useEscrow, useProtocol } from "@/hooks/use-escrow";
import { useTrackedTx } from "@/hooks/use-tx";
import { ActionPanel, AgreementCard, EscrowLinks, Timeline, TxStatus } from "@/components/escrow/views";
import { Button, Card, CopyButton, Dialog, ErrorPanel, ExternalLink, Field, Skeleton, controlClass } from "@/components/ui";

const EXPECTED: Partial<Record<ActionId, EscrowState>> = {
  fund: "Funded",
  "fund-as-agent": "Funded",
  "submit-delivery": "Delivered",
  release: "Released",
  "finalize-review": "Released",
  refund: "Refunded",
  dispute: "Disputed",
  "resolve-seller": "Released",
  "resolve-buyer": "Refunded",
  "resolve-split": "Split",
  cancel: "Cancelled",
};

export function EscrowWorkspace({ id, variant, contract }: { id: bigint; variant: "checkout" | "manage" | "receipt"; contract?: Address }) {
  const protocol = useProtocol();
  const escrowQuery = useEscrow(id, contract);
  const agreementContract = escrowQuery.contractAddress ?? contract ?? protocol.escrow.address;
  const partialSettlement = escrowQuery.partialSettlement;
  const events = useChainEvents(id, agreementContract);
  const tx = useTrackedTx();
  const queryClient = useQueryClient();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: protocol.chain.id });
  const [notice, setNotice] = useState<string>();
  const [confirming, setConfirming] = useState<ActionId>();
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState<boolean>();
  const [origin, setOrigin] = useState("");
  const [feeLabel, setFeeLabel] = useState<string>();
  const [splitAmount, setSplitAmount] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const model = escrowQuery.model;
  const wallet = protocol.account.address;
  const agentRead = useReadContract({
    address: agreementContract,
    abi: relayEscrowAbi,
    functionName: "agentAllowance",
    args: model && wallet ? [model.buyer, wallet] : undefined,
    chainId: protocol.chain.id,
    query: {
      enabled: Boolean(agreementContract && model && wallet && model.state === "Created" && !isZeroAddress(model.buyer) && !sameAddress(model.buyer, wallet)),
    },
  });
  const agentAllowance = typeof agentRead.data === "bigint" ? agentRead.data : undefined;
  const panel = model ? panelFor(model, protocol, partialSettlement, agentAllowance) : undefined;
  const checkoutPath = escrowPath("checkout", id, agreementContract);
  const checkoutUrl = origin ? `${origin}${checkoutPath}` : checkoutPath;

  useQuery({
    queryKey: ["network-fee", confirming, id.toString(), protocol.account.address],
    enabled: Boolean(confirming && publicClient && agreementContract && protocol.account.address && model),
    queryFn: async () => {
      if (!publicClient || !protocol.account.address || !agreementContract || !model || !confirming) return null;
      const call = buildCall(confirming, model, agreementContract, protocol.musd.address);
      if (!call) return null;
      const gas = await publicClient.estimateContractGas({
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
        account: protocol.account.address,
      } as never);
      const price = await publicClient.getGasPrice();
      const label = `${formatUnits(gas * price, protocol.chain.nativeCurrency.decimals)} ${protocol.chain.nativeCurrency.symbol}`;
      setFeeLabel(label);
      return label;
    },
  });

  async function refreshModel() {
    const [escrowResult] = await Promise.all([
      escrowQuery.refetch(),
      protocol.refetchBlock(),
      protocol.refetchBalances(),
      queryClient.invalidateQueries({ queryKey: ["relay-events"] }),
    ]);
    if (!escrowResult.data?.model) return undefined;
    try {
      return escrowResult.data.model;
    } catch {
      return undefined;
    }
  }

  async function preflight(action: ActionId) {
    const escrowResult = await escrowQuery.refetch();
    if (!escrowResult.data?.model || !publicClient || !agreementContract) {
      setNotice("The agreement could not be refreshed. Try again before signing.");
      return false;
    }
    const fresh = escrowResult.data.model;
    const block = await publicClient.getBlock();
    let balance = protocol.balance;
    let allowance = protocol.allowance;
    if (protocol.musd.address && protocol.account.address && protocol.escrow.address) {
      const [nextBalance, nextAllowance] = await Promise.all([
        publicClient.readContract({ address: protocol.musd.address, abi: erc20Abi, functionName: "balanceOf", args: [protocol.account.address] }),
        publicClient.readContract({ address: protocol.musd.address, abi: erc20Abi, functionName: "allowance", args: [protocol.account.address, agreementContract] }),
      ]);
      balance = nextBalance;
      allowance = nextAllowance;
    }
    let nextAgentAllowance = agentAllowance;
    if (protocol.account.address && !isZeroAddress(fresh.buyer) && !sameAddress(fresh.buyer, protocol.account.address)) {
      try {
        nextAgentAllowance = await publicClient.readContract({
          address: agreementContract,
          abi: relayEscrowAbi,
          functionName: "agentAllowance",
          args: [fresh.buyer, protocol.account.address],
        });
      } catch {
        nextAgentAllowance = undefined;
      }
    }
    const next = evaluateEscrow({
      escrow: fresh,
      wallet: protocol.account.address,
      now: Number(block.timestamp),
      chainMatches: protocol.chainMatches,
      configured: Boolean(protocol.escrow.address) && !protocol.escrow.error,
      networkName: protocol.chain.name,
      hasContractCode: protocol.hasContractCode,
      decimals: protocol.decimals,
      symbol: protocol.symbol,
      balance,
      allowance,
      nativeBalance: protocol.nativeBalance,
      partialSettlement,
      agentAllowance: nextAgentAllowance,
    });
    const offered = [next.primary, ...next.secondary].some((item) => item?.id === action);
    if (!offered) {
      setNotice("The escrow state changed. Please refresh before continuing.");
      return false;
    }
    setNotice(undefined);
    return true;
  }

  async function submit(action: ActionId, extra?: { evidenceJson?: string; evidenceHash?: Hex; reason?: string; reasonHash?: Hex; sellerAmount?: bigint }) {
    if (!model || !agreementContract) return;
    if (!(await preflight(action))) return;
    const call = buildCall(action, model, agreementContract, protocol.musd.address, extra);
    if (!call) return;
    setVerified(undefined);
    await tx.run(call.label, () => writeContractAsync({
      chainId: protocol.chain.id,
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    } as never), async () => {
      const fresh = await refreshModel();
      if (action === "approve" && publicClient && protocol.musd.address && protocol.account.address && protocol.escrow.address) {
        const allowance = await publicClient.readContract({
          address: protocol.musd.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [protocol.account.address, agreementContract],
        });
        setVerified(Boolean(fresh && allowance >= fresh.amount));
        return;
      }
      const expected = EXPECTED[action];
      setVerified(Boolean(fresh && expected && fresh.state === expected));
    });
  }

  async function onAction(action: ActionId) {
    if (action === "connect") {
      const connector = connectors[0];
      if (!connector) {
        setNotice("No injected wallet was found. Install a wallet that supports custom networks, then refresh.");
        return;
      }
      connect({ connector });
      return;
    }
    if (action === "switch-network") {
      switchChain({ chainId: protocol.chain.id });
      return;
    }
    if (action === "resolve-split") {
      if (!(await preflight(action))) return;
      setConfirming(action);
      return;
    }
    if (action === "submit-delivery" || action === "dispute") {
      if (!(await preflight(action))) return;
      setConfirming(action);
      return;
    }
    if (!(await preflight(action))) return;
    setFeeLabel(undefined);
    setConfirming(action);
  }

  if (!protocol.escrow.address || protocol.escrow.error) {
    return <ErrorPanel title="The escrow contract address is not configured." detail="On-chain actions stay disabled until NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS, or the local escrow address, is set to a deployed contract." />;
  }
  if (escrowQuery.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-56" /><Skeleton className="h-40" /></div>;
  }
  if (escrowQuery.isError || !model) {
    const missing = String(escrowQuery.error ?? "").includes("EscrowNotFound") || String(escrowQuery.error ?? "").includes("reverted");
    return <ErrorPanel title={missing ? "This agreement was not found on the escrow contract." : "The agreement could not be read."} detail="Check the agreement id, network, and contract address. A failed read is not an empty agreement." onRetry={() => void escrowQuery.refetch()} />;
  }

  const evidence = validateEvidence(evidenceNote, evidenceUrl);
  const dispute = validateReason(reason);
  const shortfall = protocol.balance !== undefined && protocol.balance < model.amount ? model.amount - protocol.balance : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-faint">{variant === "receipt" ? "Receipt" : "Agreement"} #{model.id.toString()}</p>
            <h1 className="display-title">{model.metadata?.title ?? "Protected checkout"}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CopyButton value={checkoutUrl} label="Copy checkout link" />
            <Link className="text-brand" href={escrowPath("receipt", model.id, agreementContract)}>Receipt</Link>
            <Link className="text-brand" href={`/sellers/${model.seller}`}>Seller</Link>
            <EscrowLinks id={model.id} />
          </div>
        </div>
        <AgreementCard model={model} now={protocol.now} />
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Dispute settlement</h2>
          <p className="text-sm text-muted">Only the named resolver, after a dispute.</p>
          <ul className="space-y-2 text-sm">
            <li className="rounded-2xl border border-line bg-white px-4 py-3">Full payment to the seller.</li>
            <li className="rounded-2xl border border-line bg-white px-4 py-3">Full refund to the buyer.</li>
            <li className="rounded-2xl border border-line bg-white px-4 py-3">{partialSettlement ? "Split. Seller gets the entered amount. Buyer gets the rest." : "No split on this contract."}</li>
          </ul>
          {model.metadata?.plan ? <p className="text-sm text-brand">Milestone {model.metadata.plan.index} of {model.metadata.plan.count}: {model.metadata.plan.label}</p> : null}
          <a className="inline-block text-sm font-semibold text-brand" href={`/api/x402/agreements/${model.id.toString()}`}>Machine-readable payment requirements</a>
        </Card>
        {variant !== "checkout" ? (
          <Card>
            <h2 className="text-lg font-semibold">Transaction history</h2>
            <div className="mt-4">
              <Timeline events={events.data?.items} loading={events.isLoading} error={events.isError} partial={events.data?.partial} onRetry={() => void events.refetch()} />
            </div>
          </Card>
        ) : null}
        {variant === "receipt" ? <ReceiptCard model={model} events={events.data?.items ?? []} /> : null}
      </div>
      <div className="space-y-4">
        {variant !== "receipt" ? (
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Next action</h2>
            {protocol.account.isConnected ? (
              <p className="text-sm text-muted">
                MUSD balance: <span className="num text-ink">{protocol.balance === undefined ? "—" : `${formatMusd(protocol.balance)} MUSD`}</span>
                {shortfall !== undefined && model.state === "Created" ? <span className="block">Shortfall: {formatMusd(shortfall)} MUSD</span> : null}
              </p>
            ) : null}
            {protocol.musd.address && explorerAddressUrl(protocol.musd.address) ? (
              <p className="text-sm"><ExternalLink href={explorerAddressUrl(protocol.musd.address)!}>View MUSD token</ExternalLink></p>
            ) : null}
            {agreementContract && explorerAddressUrl(agreementContract) ? (
              <p className="text-sm"><ExternalLink href={explorerAddressUrl(agreementContract)!}>View escrow contract</ExternalLink></p>
            ) : null}
            <p className="text-xs text-faint">Last chain read {protocol.blockUpdatedAt ? new Date(protocol.blockUpdatedAt).toLocaleTimeString() : "pending"}.</p>
            {notice ? <p className="text-sm text-warning" role="status">{notice}</p> : null}
            <TxStatus phase={tx.phase} />
            {tx.phase.phase === "confirmed" && verified === false ? (
              <p className="text-sm text-warning">The transaction receipt succeeded, but the expected escrow state was not read back yet. Refresh before another action.</p>
            ) : null}
            {tx.phase.phase === "confirmed" && verified ? <p className="text-sm text-brand">The contract state matches this action.</p> : null}
            {panel ? <ActionPanel panel={panel} busy={isActive(tx.phase.phase)} onAction={(action) => void onAction(action)} /> : null}
            <Button variant="ghost" onClick={() => void refreshModel()}>Refresh agreement</Button>
          </Card>
        ) : null}
        {variant === "checkout" ? (
          <Card>
            <h2 className="text-lg font-semibold">History</h2>
            <div className="mt-4">
              <Timeline events={events.data?.items} loading={events.isLoading} error={events.isError} partial={events.data?.partial} onRetry={() => void events.refetch()} />
            </div>
          </Card>
        ) : null}
      </div>

      <Dialog open={Boolean(confirming && confirming !== "submit-delivery" && confirming !== "dispute" && confirming !== "resolve-split")} title={confirmTitle(confirming)} onClose={() => setConfirming(undefined)}>
        <div className="space-y-3 text-sm text-muted">
          <div className="rounded-2xl bg-raised px-4 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Amount</p>
            <p className="num display mt-2 text-4xl leading-none text-ink">{formatMusd(model.amount)} <span className="font-sans text-base font-medium tracking-normal text-muted">MUSD</span></p>
            <p className="num mt-2 text-xs text-faint">{formatBaseUnits(model.amount)} base units</p>
          </div>
          <p>{confirmBody(confirming, model.amount)}</p>
          <p>Seller: <span className="num text-ink">{model.seller}</span></p>
          <p>Escrow: <span className="num text-ink">{agreementContract}</span></p>
          <p>Resolver: <span className="num text-ink">{shortAddress(model.resolver)}</span></p>
          <p>{RESOLVER_DISCLOSURE}</p>
          <p>{AUTO_RELEASE_DISCLOSURE}</p>
          <p>{feeLabel ? `Network fee: ${feeLabel}. Not a protocol fee.` : "Your wallet shows the BTC network fee."}</p>
          <p>{NO_FEE_DISCLOSURE}</p>
          <div className="flex gap-2">
            <Button onClick={() => { const action = confirming; setConfirming(undefined); if (action) void submit(action); }}>Confirm and sign</Button>
            <Button variant="secondary" onClick={() => setConfirming(undefined)}>Back</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={confirming === "submit-delivery"} title="Submit delivery evidence" onClose={() => setConfirming(undefined)}>
        <div className="space-y-3">
          <p className="text-sm text-muted">Public on-chain. No secrets or personal data.</p>
          <Field label="Delivery note" hint="At least 3 characters. Public on-chain." error={evidenceNote.trim() ? evidence.errors.note : undefined}>
            <textarea className={controlClass} value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} rows={4} />
          </Field>
          <Field label="HTTPS link, optional" error={evidenceUrl.trim() ? evidence.errors.url : undefined}>
            <input className={controlClass} value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://" />
          </Field>
          <p className="break-all text-xs text-faint">Evidence hash {evidence.evidenceHash}</p>
          <Button disabled={!evidence.valid} onClick={() => { setConfirming(undefined); void submit("submit-delivery", { evidenceHash: evidence.evidenceHash, evidenceJson: evidence.json }); }}>Submit evidence</Button>
        </div>
      </Dialog>

      <Dialog open={confirming === "resolve-split"} title="Split the disputed amount" onClose={() => setConfirming(undefined)}>
        <SplitDialog
          amount={model.amount}
          value={splitAmount}
          onChange={setSplitAmount}
          onSubmit={(sellerAmount) => {
            setConfirming(undefined);
            void submit("resolve-split", { sellerAmount });
          }}
        />
      </Dialog>

      <Dialog open={confirming === "dispute"} title="Raise a dispute" onClose={() => setConfirming(undefined)}>
        <div className="space-y-3">
          <p className="text-sm text-muted">Public on-chain. Pauses release and refund.</p>
          <Field label="Reason" hint="Public on-chain." error={reason.trim() && dispute.ok === false ? dispute.error : undefined}>
            <textarea className={controlClass} value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
          </Field>
          <Button disabled={!dispute.ok} onClick={() => { if (!dispute.ok) return; setConfirming(undefined); void submit("dispute", { reason: dispute.reason, reasonHash: dispute.reasonHash }); }}>Submit dispute</Button>
        </div>
      </Dialog>
    </div>
  );
}

function SplitDialog({ amount, value, onChange, onSubmit }: { amount: bigint; value: string; onChange: (value: string) => void; onSubmit: (sellerAmount: bigint) => void }) {
  const parsed = parseMusdInput(value);
  const sellerAmount = parsed.ok ? parsed.amount : undefined;
  const valid = sellerAmount !== undefined && sellerAmount > 0n && sellerAmount < amount;
  return (
    <div className="space-y-3 text-sm text-muted">
      <p>Seller gets what you enter. Buyer gets the rest of {formatMusd(amount)} MUSD.</p>
      <Field label="Seller amount in MUSD" error={value.trim() && parsed.ok === false ? parsed.error : value.trim() && parsed.ok && !valid ? "Enter more than zero and less than the full escrow amount." : undefined}>
        <input className={`${controlClass} num`} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
      </Field>
      {valid && sellerAmount !== undefined ? <p>Buyer receives {formatMusd(amount - sellerAmount)} MUSD.</p> : null}
      <Button disabled={!valid || sellerAmount === undefined} onClick={() => sellerAmount !== undefined && onSubmit(sellerAmount)}>Sign split settlement</Button>
    </div>
  );
}

function isActive(phase: string) {
  return phase === "awaiting_wallet" || phase === "submitted" || phase === "confirming" || phase === "preparing";
}

function confirmTitle(action?: ActionId) {
  switch (action) {
    case "approve": return "Approve MUSD";
    case "fund": return "Fund escrow";
    case "fund-as-agent": return "Fund with agent budget";
    case "release": return "Release funds";
    case "refund": return "Refund after missed deadline";
    case "finalize-review": return "Finalize payment to seller";
    case "cancel": return "Cancel unfunded checkout";
    case "resolve-seller": return "Release the full amount to the seller";
    case "resolve-buyer": return "Refund the full amount to the buyer";
    default: return "Confirm transaction";
  }
}

function confirmBody(action: ActionId | undefined, amount: bigint) {
  const value = formatMusd(amount);
  switch (action) {
    case "approve":
      return `Approves exactly ${value} MUSD. Does not send it.`;
    case "fund":
      return `Locks ${value} MUSD under this agreement.`;
    case "fund-as-agent":
      return `Pulls ${value} MUSD from the buyer. You stay an agent.`;
    case "release":
      return "Pays the seller. Cannot be undone.";
    case "refund":
      return "Returns the MUSD to the buyer. Delivery was missed.";
    case "finalize-review":
      return "Review ended. Pays the seller. You receive nothing.";
    case "cancel":
      return "Cancels the unfunded agreement. No tokens move.";
    case "resolve-seller":
      return "Full amount to the seller.";
    case "resolve-buyer":
      return "Full amount to the buyer.";
    default:
      return "Review it in your wallet before you sign.";
  }
}

function buildCall(
  action: ActionId,
  model: { id: bigint; amount: bigint },
  escrowAddress: `0x${string}`,
  musdAddress?: `0x${string}`,
  extra?: { evidenceJson?: string; evidenceHash?: Hex; reason?: string; reasonHash?: Hex; sellerAmount?: bigint },
) {
  const escrow = { address: escrowAddress, abi: relayEscrowAbi };
  switch (action) {
    case "approve":
      if (!musdAddress) return undefined;
      return { label: "Approve MUSD", address: musdAddress, abi: erc20Abi, functionName: "approve", args: [escrowAddress, model.amount] };
    case "fund":
      return { label: "Fund escrow", ...escrow, functionName: "fundEscrow", args: [model.id] };
    case "fund-as-agent":
      return { label: "Fund with agent budget", ...escrow, functionName: "fundEscrowAsAgent", args: [model.id] };
    case "cancel":
      return { label: "Cancel unfunded checkout", ...escrow, functionName: "cancelUnfunded", args: [model.id] };
    case "release":
      return { label: "Release funds", ...escrow, functionName: "releaseToSeller", args: [model.id] };
    case "finalize-review":
      return { label: "Finalize payment", ...escrow, functionName: "releaseAfterReviewWindow", args: [model.id] };
    case "refund":
      return { label: "Refund", ...escrow, functionName: "refundAfterMissedDeadline", args: [model.id] };
    case "submit-delivery":
      return { label: "Submit delivery", ...escrow, functionName: "submitDelivery", args: [model.id, extra?.evidenceHash, extra?.evidenceJson] };
    case "dispute":
      return { label: "Raise dispute", ...escrow, functionName: "raiseDispute", args: [model.id, extra?.reasonHash, extra?.reason] };
    case "resolve-seller":
      return { label: "Resolve to seller", ...escrow, functionName: "resolveDispute", args: [model.id, true] };
    case "resolve-buyer":
      return { label: "Resolve to buyer", ...escrow, functionName: "resolveDispute", args: [model.id, false] };
    case "resolve-split":
      if (extra?.sellerAmount === undefined) return undefined;
      return { label: "Split disputed amount", ...escrow, functionName: "resolveDisputeSplit", args: [model.id, extra.sellerAmount] };
    default:
      return undefined;
  }
}

function ReceiptCard({ model, events }: { model: { id: bigint; state: EscrowState; amount: bigint; seller: string; buyer: string; resolver: string; metadataHash: Hex; termsHash: Hex; evidenceHash: Hex }; events: { name: string; transactionHash: string; blockNumber: bigint; timestamp?: number }[] }) {
  const payload = {
    product: "RELAY",
    agreementId: model.id.toString(),
    state: model.state,
    amountBaseUnits: model.amount.toString(),
    displayAmount: formatMusd(model.amount),
    token: "MUSD",
    seller: model.seller,
    buyer: model.buyer,
    resolver: model.resolver,
    metadataHash: model.metadataHash,
    termsHash: model.termsHash,
    evidenceHash: model.evidenceHash,
    events: events.map((event) => ({
      name: event.name,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber.toString(),
      timestamp: event.timestamp ?? null,
    })),
  };
  const json = JSON.stringify(payload, null, 2);
  return (
    <Card>
      <h2 className="text-lg font-semibold">Receipt</h2>
      <p className="mt-2 text-sm text-muted">A record of what was read. Not a rating of the work.</p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-bg p-3 text-xs text-muted">{json}</pre>
      <div className="mt-3"><CopyButton value={json} label="Copy receipt JSON" /></div>
    </Card>
  );
}
