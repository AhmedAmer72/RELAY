"use client";

import { FAQ, HOW_STEPS } from "@/lib/content";
import { addAppChain, OFFICIAL_LINKS, VERIFIED_TESTNET, explorerAddressUrl, getAppChain, getEscrowConfig, getMusdConfig, getRpcUrl } from "@/lib/chain/config";
import { APP_VERSION } from "@/lib/version";
import { AUTO_RELEASE_DISCLOSURE, RESOLVER_DISCLOSURE } from "@/lib/escrow/constants";
import { useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { shortAddress } from "@/lib/escrow/format";
import Link from "next/link";
import { AgentBudgetPanel } from "@/components/screens/agent-budget";
import { MezoMark } from "@/components/mezo-mark";
import { Button, Card, ExternalLink } from "@/components/ui";

export function HowItWorksScreen() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="display-title">How RELAY works</h1>
        <p className="mt-3 text-muted">Payment follows the agreement.</p>
      </div>
      <ol className="space-y-4">
        {HOW_STEPS.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs text-brand">Step {index + 1}</p>
            <h2 className="display mt-1 text-xl uppercase leading-[0.95]">{step.title}</h2>
            <p className="mt-2 text-sm text-muted">{step.copy}</p>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/create" className="rounded-[28px] border border-line bg-[#f3f8ea] p-5">
          <h2 className="font-semibold">Milestones</h2>
          <p className="mt-2 text-sm text-muted">One agreement per stage.</p>
        </Link>
        <Link href="/agents" className="rounded-[28px] border border-line bg-[#f3f8ea] p-5">
          <h2 className="font-semibold">Agent budgets</h2>
          <p className="mt-2 text-sm text-muted">Cap what another address can fund.</p>
        </Link>
        <Link href="/dashboard" className="rounded-[28px] border border-line bg-[#f3f8ea] p-5">
          <h2 className="font-semibold">Receipts and profiles</h2>
          <p className="mt-2 text-sm text-muted">Completed checkouts and receipts.</p>
        </Link>
      </div>
      <Card>
        <h2 className="font-semibold">Deadline rules</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>The buyer can fund at or before the funding deadline.</li>
          <li>The seller can submit delivery at or before the delivery deadline.</li>
          <li>The buyer can refund only after that deadline, and only if delivery was not submitted.</li>
          <li>After delivery, the buyer can release or either party can dispute through the review deadline.</li>
          <li>{AUTO_RELEASE_DISCLOSURE}</li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Dispute resolver</h2>
        <p className="mt-3 text-sm text-muted">{RESOLVER_DISCLOSURE}</p>
      </Card>
      <div className="space-y-3">
        {FAQ.map((item) => (
          <details key={item.question} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer font-medium">{item.question}</summary>
            <p className="mt-2 text-sm text-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { address, isConnected, chainId } = useAccount();
  const [networkMessage, setNetworkMessage] = useState<string>();
  const chain = getAppChain();
  const escrow = getEscrowConfig();
  const musd = getMusdConfig();
  const escrowUrl = explorerAddressUrl(escrow.address);
  const musdUrl = explorerAddressUrl(musd.address);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="display-title">Settings</h1>
        <p className="mt-2 text-sm text-muted">Network and contracts. No seed phrase. No private key.</p>
      </div>
      <AgentBudgetPanel />
      <Card className="space-y-2 text-sm">
        <Row label="Wallet" value={isConnected && address ? shortAddress(address) : "Not connected"} />
        <Row label="Wallet chain" value={chainId ? String(chainId) : "—"} />
        <Row
          label="Required network"
          value={
            <span className="inline-flex items-center justify-end gap-2">
              {chain.id === VERIFIED_TESTNET.chainId ? <MezoMark /> : null}
              {chain.name} ({chain.id})
            </span>
          }
        />
        <Row label="RPC" value={getRpcUrl()} />
        <Row label="Gas token" value={`${chain.nativeCurrency.symbol}, ${chain.nativeCurrency.decimals} decimals`} />
        <Row label="MUSD" value={musd.address ?? musd.error ?? "Missing"} />
        <Row label="Escrow" value={escrow.address ?? escrow.error ?? "Not configured"} />
        <Row label="App version" value={APP_VERSION} />
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 font-semibold">{chain.id === VERIFIED_TESTNET.chainId ? <MezoMark className="size-5" /> : null}Add {chain.name}</h2>
        <div className="mt-3">
          <Button
            onClick={() => {
              setNetworkMessage(undefined);
              void addAppChain().catch((error: unknown) => {
                setNetworkMessage(error instanceof Error ? error.message : `The wallet could not add ${chain.name}.`);
              });
            }}
          >
            Add {chain.name} to wallet
          </Button>
          {networkMessage ? <p className="mt-2 text-sm text-danger">{networkMessage}</p> : null}
        </div>
        <h3 className="mt-4 font-semibold">Or add it manually</h3>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          <li>Network name: {chain.name}</li>
          <li>Chain ID: {chain.id}</li>
          <li>RPC: {getRpcUrl()}</li>
          <li>Currency symbol: {chain.nativeCurrency.symbol}</li>
          <li>Explorer: {chain.blockExplorers?.default.url ?? "Not available on the local chain"}</li>
        </ul>
        <div className="mt-4 space-y-2 text-sm">
          {musdUrl ? <p><ExternalLink href={musdUrl}>MUSD on explorer</ExternalLink></p> : null}
          {escrowUrl ? <p><ExternalLink href={escrowUrl}>Escrow on explorer</ExternalLink></p> : null}
          <p><ExternalLink href={OFFICIAL_LINKS.faucet}>Testnet BTC faucet</ExternalLink></p>
          <p><ExternalLink href={OFFICIAL_LINKS.borrow}>Borrow testnet MUSD</ExternalLink></p>
          <p><Link className="text-brand" href="/docs">Security notes</Link></p>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-faint">{label}</dt><dd className="num max-w-[70%] break-all text-right">{value}</dd></div>;
}
