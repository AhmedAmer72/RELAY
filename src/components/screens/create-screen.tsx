"use client";

import { useMemo, useState } from "react";
import { decodeEventLog, type TransactionReceipt } from "viem";
import { useConfig, useConnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { NO_FEE_DISCLOSURE, RESOLVER_DISCLOSURE, REVIEW_PRESETS, AUTO_RELEASE_DISCLOSURE } from "@/lib/escrow/constants";
import { formatMusd, parseMusdInput, shortAddress } from "@/lib/escrow/format";
import { formatTimestamp, localInputToUnix, unixToLocalInput } from "@/lib/escrow/time";
import { coerceRawEscrow, parseEscrow } from "@/lib/escrow/parse";
import { buildMetadata } from "@/lib/metadata/canonical";
import { validateCreateDraft, validateMilestones, type CreateDraft, type MilestoneDraft } from "@/lib/validation/create";
import { useProtocol } from "@/hooks/use-escrow";
import { useTrackedTx } from "@/hooks/use-tx";
import { TxStatus } from "@/components/escrow/views";
import { Button, Card, CopyButton, Field, StepRail, controlClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

function initialDraft(): CreateDraft {
  const now = Math.floor(Date.now() / 1000);
  return {
    title: "",
    description: "",
    terms: "",
    amount: "",
    buyerMode: "specific",
    buyer: "",
    resolver: "",
    fundingDeadline: now + 24 * 60 * 60,
    deliveryDeadline: now + 72 * 60 * 60,
    reviewPeriod: 48 * 60 * 60,
    acknowledged: false,
    milestones: [],
  };
}

function blankMilestone(draft: CreateDraft): MilestoneDraft {
  return {
    label: "",
    amount: draft.amount,
    deliveryDeadline: draft.deliveryDeadline,
    reviewPeriod: draft.reviewPeriod,
  };
}

export function CreateScreen() {
  const protocol = useProtocol();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CreateDraft>(initialDraft);
  const [createdId, setCreatedId] = useState<bigint>();
  const [createdIds, setCreatedIds] = useState<bigint[]>([]);
  const [planProgress, setPlanProgress] = useState<string>();
  const [createWarning, setCreateWarning] = useState<string>();
  const [origin, setOrigin] = useState("");
  const [attempted, setAttempted] = useState(false);
  const tx = useTrackedTx();
  const publicClient = usePublicClient({ chainId: protocol.chain.id });
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const seller = protocol.account.address;
  const validation = useMemo(() => validateCreateDraft(draft, seller), [draft, seller]);
  const milestoneCheck = useMemo(() => validateMilestones(draft), [draft]);
  const usingMilestones = (draft.milestones?.length ?? 0) >= 2;
  const steps = ["Payment details", "Delivery and review", "Review and create"];

  function patch(partial: Partial<CreateDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function canLeave(index: number) {
    if (index === 0) {
      const amountOk = usingMilestones || !validation.errors.amount;
      return milestoneCheck.valid && amountOk && !validation.errors.title && !validation.errors.description && !validation.errors.buyer && !validation.errors.terms;
    }
    if (index === 1) return !validation.errors.fundingDeadline && !validation.errors.deliveryDeadline && !validation.errors.reviewPeriod && !validation.errors.resolver;
    return validation.valid;
  }

  async function createPlan(buyer: `0x${string}`) {
    if (!protocol.escrow.address || !seller || !publicClient) return;
    const rows = draft.milestones ?? [];
    if (!milestoneCheck.valid) return;
    const planId = crypto.randomUUID();
    const ids: bigint[] = [];
    setPlanProgress(`Creating milestone 1 of ${rows.length}`);
    try {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const amount = parseMusdInput(row.amount);
        if (!amount.ok || !row.deliveryDeadline || !draft.fundingDeadline) throw new Error("A milestone is incomplete.");
        const metadata = buildMetadata({
          title: `${draft.title.trim()} — ${row.label.trim()}`,
          description: draft.description.trim(),
          terms: draft.terms.trim(),
          plan: { id: planId, index: index + 1, count: rows.length, label: row.label.trim() },
        });
        setPlanProgress(`Creating milestone ${index + 1} of ${rows.length}. Confirm it in your wallet.`);
        const hash = await writeContractAsync({
          chainId: protocol.chain.id,
          address: protocol.escrow.address,
          abi: relayEscrowAbi,
          functionName: "createEscrow",
          args: [
            buyer,
            draft.resolver as `0x${string}`,
            amount.amount,
            BigInt(draft.fundingDeadline),
            BigInt(row.deliveryDeadline),
            row.reviewPeriod,
            metadata.termsHash,
            metadata.metadataHash,
            metadata.json,
          ],
        });
        const receipt = await waitForTransactionReceipt(config, { hash, timeout: 120_000 });
        if (receipt.status !== "success") throw new Error(`Milestone ${index + 1} was not confirmed.`);
        const id = readCreatedId(receipt);
        if (id === undefined) throw new Error(`Milestone ${index + 1} was confirmed, but its agreement id was not found.`);
        ids.push(id);
      }
      setOrigin(window.location.origin);
      setCreatedIds(ids);
      setPlanProgress(undefined);
    } catch (error) {
      setCreatedIds(ids);
      setPlanProgress(undefined);
      setCreateWarning(error instanceof Error ? error.message : "Milestone creation stopped. Check the explorer before trying again.");
    }
  }

  async function create() {
    setAttempted(true);
    if (!protocol.escrow.address || !seller || !publicClient) return;
    const checked = validateCreateDraft(draft, seller);
    if (!checked.valid || !checked.amount || !draft.fundingDeadline || !draft.deliveryDeadline) return;
    if (!protocol.chainMatches) {
      switchChain({ chainId: protocol.chain.id });
      return;
    }
    const metadata = buildMetadata({
      title: draft.title.trim(),
      description: draft.description.trim(),
      terms: draft.terms.trim(),
    });
    setCreatedId(undefined);
    setCreatedIds([]);
    setCreateWarning(undefined);
    if (usingMilestones) {
      await createPlan(checked.buyer as `0x${string}`);
      return;
    }
    await tx.run("Create protected checkout", () => writeContractAsync({
      chainId: protocol.chain.id,
      address: protocol.escrow.address!,
      abi: relayEscrowAbi,
      functionName: "createEscrow",
      args: [
        checked.buyer as `0x${string}`,
        draft.resolver as `0x${string}`,
        checked.amount!,
        BigInt(draft.fundingDeadline!),
        BigInt(draft.deliveryDeadline!),
        draft.reviewPeriod,
        metadata.termsHash,
        metadata.metadataHash,
        metadata.json,
      ],
    }), async (receipt) => {
      try {
        const id = readCreatedId(receipt);
        if (id === undefined) {
          setCreateWarning("The transaction was confirmed, but the agreement id was not found in the receipt. Check the explorer before creating another one.");
          return;
        }
        const stored = await publicClient.readContract({
          address: protocol.escrow.address!,
          abi: relayEscrowAbi,
          functionName: "getEscrow",
          args: [id],
        });
        const parsed = parseEscrow(id, coerceRawEscrow(stored));
        if (!parsed.metadataVerified || parsed.metadataHash !== metadata.metadataHash) {
          setCreateWarning("The transaction was confirmed, but the stored agreement did not match what you submitted.");
          return;
        }
        setOrigin(window.location.origin);
        setCreatedId(id);
      } catch {
        setCreateWarning("The transaction was confirmed, but the agreement could not be read back. Check the explorer before creating another one.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.14em] text-faint">Seller</p>
      <h1 className="display-title mt-1">Create a protected checkout</h1>
      <p className="mt-2 text-sm text-muted">Stored on the escrow. Creation does not move MUSD.</p>
      <div className="mt-6">
        <StepRail steps={steps} current={step} label="Create checkout steps" />
      </div>
      <Card className="form-panel mt-6 space-y-5">
        <div key={step} className="step-fade space-y-5">
        {step === 0 ? (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink" id="payment-shape-label">Payment shape</p>
              <div className="grid grid-cols-2 gap-1 rounded-full border-2 border-[#163300] bg-white p-1" role="radiogroup" aria-labelledby="payment-shape-label">
                <label className={cn("cursor-pointer rounded-full px-3 py-2 text-center text-sm font-semibold", !usingMilestones ? "bg-brand text-white" : "text-muted")}>
                  <input className="sr-only" type="radio" name="payment-shape" checked={!usingMilestones} onChange={() => patch({ milestones: [] })} />
                  One payment
                </label>
                <label className={cn("cursor-pointer rounded-full px-3 py-2 text-center text-sm font-semibold", usingMilestones ? "bg-brand text-white" : "text-muted")}>
                  <input className="sr-only" type="radio" name="payment-shape" checked={usingMilestones} onChange={() => { if ((draft.milestones?.length ?? 0) < 2) patch({ milestones: [blankMilestone(draft), blankMilestone(draft)] }); }} />
                  Milestones
                </label>
              </div>
              <p className="mt-2 text-sm text-muted">{usingMilestones ? "Each stage is its own funded agreement." : "One amount. One delivery."}</p>
            </div>
            <Field label="Title" error={attempted ? validation.errors.title : undefined} hint="3–80 characters.">
              <input className={controlClass} value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
            </Field>
            <Field label="What are you delivering?" error={attempted ? validation.errors.description : undefined}>
              <textarea className={controlClass} rows={3} value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
            </Field>
            {usingMilestones ? null : (
              <Field label="Amount in MUSD" error={attempted ? validation.errors.amount : undefined} hint="18 decimals. Not rounded.">
                <input className={`${controlClass} num`} inputMode="decimal" value={draft.amount} onChange={(event) => patch({ amount: event.target.value })} />
              </Field>
            )}
            <div>
              <p className="mb-2 text-sm font-semibold text-ink" id="buyer-mode-label">Buyer</p>
              <div className="grid grid-cols-2 gap-1 rounded-full border-2 border-[#163300] bg-white p-1" role="radiogroup" aria-labelledby="buyer-mode-label">
                {([["specific", "Specific buyer"], ["open", "Anyone with the link"]] as const).map(([mode, label]) => (
                  <label key={mode} className={cn("cursor-pointer rounded-full px-3 py-2 text-center text-sm font-semibold transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand", draft.buyerMode === mode ? "bg-brand text-white" : "text-muted hover:text-ink")}>
                    <input className="sr-only" type="radio" name="buyer-mode" value={mode} checked={draft.buyerMode === mode} onChange={() => patch({ buyerMode: mode })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {usingMilestones ? <div className="space-y-3 rounded-2xl border-2 border-[#163300] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Milestones</p>
                <Button
                  variant="secondary"
                  onClick={() => patch({ milestones: [...(draft.milestones ?? []), blankMilestone(draft), ...(draft.milestones?.length ? [] : [blankMilestone(draft)])].slice(0, 5) })}
                >
                  Add milestone
                </Button>
              </div>
              {(draft.milestones ?? []).map((row, index) => (
                <div key={`${index}-${row.label}`} className="grid gap-2 border-t border-line pt-3">
                  <div className="flex justify-end">
                    <Button variant="ghost" onClick={() => {
                      const next = (draft.milestones ?? []).filter((_, itemIndex) => itemIndex !== index);
                      patch({ milestones: next.length < 2 ? [] : next });
                    }}>Remove</Button>
                  </div>
                  <Field label={`Milestone ${index + 1} name`} error={attempted ? milestoneCheck.errors[`label-${index}`] : undefined}>
                    <input className={controlClass} value={row.label} onChange={(event) => patch({ milestones: draft.milestones?.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} />
                  </Field>
                  <Field label="Amount in MUSD" error={attempted ? milestoneCheck.errors[`amount-${index}`] : undefined}>
                    <input className={`${controlClass} num`} inputMode="decimal" value={row.amount} onChange={(event) => patch({ milestones: draft.milestones?.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item) })} />
                  </Field>
                  <Field label="Delivery deadline" error={milestoneCheck.errors[`delivery-${index}`]}>
                    <input className={controlClass} type="datetime-local" value={row.deliveryDeadline ? unixToLocalInput(row.deliveryDeadline) : ""} onChange={(event) => patch({ milestones: draft.milestones?.map((item, itemIndex) => itemIndex === index ? { ...item, deliveryDeadline: localInputToUnix(event.target.value) } : item) })} />
                  </Field>
                </div>
              ))}
              {milestoneCheck.errors.milestones ? <p className="text-sm text-danger">{milestoneCheck.errors.milestones}</p> : null}
            </div> : null}
            {draft.buyerMode === "specific" ? (
              <Field label="Buyer wallet" error={attempted ? validation.errors.buyer : undefined}>
                <input className={`${controlClass} num`} value={draft.buyer} onChange={(event) => patch({ buyer: event.target.value.trim() })} placeholder="0x" />
              </Field>
            ) : <p className="text-sm text-muted">The first funder becomes the buyer. Seller and resolver cannot fund it.</p>}
            <Field label="Terms" error={attempted ? validation.errors.terms : undefined} hint="Public on-chain.">
              <textarea className={controlClass} rows={4} value={draft.terms} onChange={(event) => patch({ terms: event.target.value })} />
            </Field>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Field label="Funding deadline" error={validation.errors.fundingDeadline} hint="Checked when the transaction is mined.">
              <input className={controlClass} type="datetime-local" value={draft.fundingDeadline ? unixToLocalInput(draft.fundingDeadline) : ""} onChange={(event) => patch({ fundingDeadline: localInputToUnix(event.target.value) })} />
            </Field>
            <Field label="Delivery deadline" error={validation.errors.deliveryDeadline} hint="Must be at least 1 hour after the funding deadline.">
              <input className={controlClass} type="datetime-local" value={draft.deliveryDeadline ? unixToLocalInput(draft.deliveryDeadline) : ""} onChange={(event) => patch({ deliveryDeadline: localInputToUnix(event.target.value) })} />
            </Field>
            <Field label="Review window" error={validation.errors.reviewPeriod} hint={AUTO_RELEASE_DISCLOSURE}>
              <select className={controlClass} value={draft.reviewPeriod} onChange={(event) => patch({ reviewPeriod: Number(event.target.value) })}>
                {REVIEW_PRESETS.map((preset) => <option key={preset.id} value={preset.seconds}>{preset.label} — {preset.hint}</option>)}
              </select>
            </Field>
            <Field label="Dispute resolver" error={attempted ? validation.errors.resolver : undefined} hint="Can pay the seller, refund the buyer, or split.">
              <input className={`${controlClass} num`} value={draft.resolver} onChange={(event) => patch({ resolver: event.target.value.trim() })} placeholder="0x" />
            </Field>
          </>
        ) : null}
        {step === 2 ? (
          <Review draft={draft} seller={seller} amount={validation.amount} metadataBytes={validation.metadataBytes} />
        ) : null}
        </div>
        {step === 2 ? (
          <label className="flex items-start gap-3 rounded-2xl border-2 border-[#163300] bg-white p-4 text-sm font-medium">
            <input type="checkbox" className="mt-0.5 size-5 accent-[#163300]" checked={draft.acknowledged} onChange={(event) => patch({ acknowledged: event.target.checked })} />
            <span>I have reviewed the details and understand the dispute resolver and review-window rule shown above.</span>
          </label>
        ) : null}
        <TxStatus phase={tx.phase} />
        {createWarning ? <p className="text-sm text-warning">{createWarning}</p> : null}
        {planProgress ? <p className="flex items-center gap-2 text-sm text-brand"><span className="live-dot" aria-hidden />{planProgress}</p> : null}
        {createdIds.length > 0 ? (
          <div className="pop-in rounded-2xl bg-[#e7f8d4] p-4 text-sm">
            <p className="font-medium text-brand">{createdIds.length} milestone agreements were read from confirmed transactions.</p>
            <ul className="mt-2 space-y-1">
              {createdIds.map((id) => <li key={id.toString()} className="break-all">{origin}/checkout/{id.toString()}</li>)}
            </ul>
          </div>
        ) : null}
        {createdId ? (
          <div className="pop-in rounded-2xl bg-[#e7f8d4] p-4 text-sm">
            <p className="font-medium text-brand">Agreement {createdId.toString()} was read from the confirmed transaction.</p>
            <p className="mt-2 break-all">{origin}/checkout/{createdId.toString()}</p>
            <div className="mt-2"><CopyButton value={`${origin}/checkout/${createdId.toString()}`} label="Copy checkout link" /></div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {step > 0 ? <Button variant="secondary" onClick={() => setStep((value) => value - 1)}>Back</Button> : null}
          {step < 2 ? <Button onClick={() => { setAttempted(true); if (canLeave(step)) setStep((value) => value + 1); }}>Continue</Button> : null}
          {step === 2 && !seller ? <Button onClick={() => connectors[0] && connect({ connector: connectors[0] })}>Connect wallet</Button> : null}
          {step === 2 && seller && !protocol.chainMatches ? <Button onClick={() => switchChain({ chainId: protocol.chain.id })}>Switch to {protocol.chain.name}</Button> : null}
          {step === 2 && seller && protocol.chainMatches ? (
            <Button disabled={!validation.valid || !milestoneCheck.valid || !protocol.escrow.address || Boolean(planProgress)} busy={isActive(tx.phase.phase)} onClick={() => void create()}>
              {usingMilestones ? "Create milestone checkouts" : "Create protected checkout"}
            </Button>
          ) : null}
        </div>
        {!protocol.escrow.address ? <p className="text-sm text-warning">The escrow contract address is not configured, so creation is disabled.</p> : null}
        {validation.errors.title || validation.errors.amount || validation.errors.buyer || validation.errors.resolver || validation.errors.fundingDeadline || validation.errors.deliveryDeadline ? (
          step === 2 ? <p className="text-sm text-danger">Go back and correct the highlighted fields before creating the agreement.</p> : null
        ) : null}
      </Card>
    </div>
  );
}

function Review({ draft, seller, amount, metadataBytes }: { draft: CreateDraft; seller?: string; amount?: bigint; metadataBytes: number }) {
  const metadata = draft.title && draft.description && draft.terms ? buildMetadata({ title: draft.title.trim(), description: draft.description.trim(), terms: draft.terms.trim() }) : undefined;
  return (
    <div className="space-y-2 rounded-2xl border-2 border-[#163300] bg-white p-4 text-sm">
      <Row label="Title" value={draft.title || "—"} />
      <Row label="Description" value={draft.description || "—"} />
      {(draft.milestones?.length ?? 0) >= 2 ? (
        <div className="space-y-2 border-b border-line pb-3">
          <p className="font-semibold">Milestones</p>
          {draft.milestones?.map((row, index) => (
            <Row key={`${row.label}-${index}`} label={`${index + 1}. ${row.label || "Untitled"}`} value={row.amount ? `${row.amount} MUSD` : "—"} />
          ))}
        </div>
      ) : <Row label="Amount" value={amount ? `${formatMusd(amount)} MUSD` : "—"} />}
      <Row label="Buyer" value={draft.buyerMode === "open" ? "Anyone with the link" : draft.buyer || "—"} />
      <Row label="Seller" value={seller ? shortAddress(seller) : "Connect a wallet"} />
      <Row label="Funding deadline" value={formatTimestamp(draft.fundingDeadline)} />
      <Row label="Delivery deadline" value={formatTimestamp(draft.deliveryDeadline)} />
      <Row label="Review window" value={REVIEW_PRESETS.find((preset) => preset.seconds === draft.reviewPeriod)?.label ?? `${draft.reviewPeriod} seconds`} />
      <Row label="Resolver" value={draft.resolver || "—"} />
      <p className="text-muted">{AUTO_RELEASE_DISCLOSURE}</p>
      <p className="text-muted">{RESOLVER_DISCLOSURE}</p>
      <p className="text-faint">{NO_FEE_DISCLOSURE}</p>
      <p className="text-faint">On-chain metadata size: {metadataBytes || metadata?.json.length || 0} bytes. Limit 2048.</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-faint">{label}</span><span className="num max-w-[65%] break-all text-right">{value}</span></div>;
}

function isActive(phase: string) {
  return phase === "awaiting_wallet" || phase === "submitted" || phase === "confirming";
}

export function readCreatedId(receipt: TransactionReceipt) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: relayEscrowAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "EscrowCreated") return decoded.args.escrowId;
    } catch {
      continue;
    }
  }
  return undefined;
}
