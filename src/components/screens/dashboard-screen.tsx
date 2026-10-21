"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { escrowPath, VERIFIED_TESTNET } from "@/lib/chain/config";
import { formatMusd, sameAddress, shortAddress } from "@/lib/escrow/format";
import { formatRelative } from "@/lib/escrow/time";
import { requiresUserAction } from "@/lib/escrow/policy";
import type { EscrowModel } from "@/lib/escrow/types";
import { getAddress, isAddress, type Address } from "viem";
import { useProtocol, useRecentEscrows } from "@/hooks/use-escrow";
import { ProgressRail, StatusBadge } from "@/components/escrow/views";
import { MezoMark } from "@/components/mezo-mark";
import { Button, Card, CopyButton, EmptyState, ErrorPanel, Field, FilterChip, Skeleton, controlClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const FILTERS = ["All", "Needs my action", "As buyer", "As seller", "Completed", "Disputed"] as const;
type Filter = (typeof FILTERS)[number];

export function DashboardScreen() {
  const protocol = useProtocol();
  const [limit, setLimit] = useState(1000);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [sellerLookup, setSellerLookup] = useState("");
  const [sellerError, setSellerError] = useState("");
  const router = useRouter();
  const list = useRecentEscrows(limit);
  const wallet = protocol.account.address;

  const mine = useMemo(() => {
    if (!wallet) return [];
    return list.models.filter((escrow) => sameAddress(escrow.seller, wallet) || sameAddress(escrow.buyer, wallet) || sameAddress(escrow.resolver, wallet));
  }, [list.models, wallet]);

  const filtered = mine.filter((escrow) => matches(escrow, filter, query, wallet, protocol.now));
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const secured = mine.filter((escrow) => escrow.state === "Funded" || escrow.state === "Delivered" || escrow.state === "Disputed").reduce((sum, escrow) => sum + escrow.amount, 0n);
  const actionCount = mine.filter((escrow) => requiresUserAction(escrow, wallet, protocol.now)).length;
  const completed = mine.filter((escrow) => escrow.state === "Released" || escrow.state === "Refunded" || escrow.state === "Cancelled" || escrow.state === "Split").length;
  const disputed = mine.filter((escrow) => escrow.state === "Disputed").length;
  const ready = Boolean(wallet && protocol.escrow.address && !list.isLoading && !list.isError);

  const lookupCard = (
    <Card className="form-panel">
      <h2 className="text-lg font-semibold">Open a checkout</h2>
      <p className="mt-1 text-sm text-muted">Use the id from a checkout link.</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (/^[1-9]\d*$/.test(lookup)) {
            setLookupError("");
            router.push(`/checkout/${lookup}`);
            return;
          }
          setLookupError("Enter the agreement number from the checkout link.");
        }}
      >
        <Field label="Agreement id" error={lookupError || undefined}>
          <input
            className={`${controlClass} num`}
            value={lookup}
            onChange={(event) => {
              setLookup(event.target.value);
              setLookupError("");
            }}
            placeholder="Agreement id"
            inputMode="numeric"
          />
        </Field>
        <Button type="submit" variant="secondary" className="w-full">Open checkout</Button>
      </form>
      <form
        className="mt-6 space-y-3 border-t border-[#163300]/20 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (isAddress(sellerLookup)) {
            setSellerError("");
            router.push(`/sellers/${getAddress(sellerLookup)}`);
            return;
          }
          setSellerError("Enter the seller wallet address.");
        }}
      >
        <Field label="Seller address" error={sellerError || undefined}>
          <input
            className={`${controlClass} num`}
            value={sellerLookup}
            onChange={(event) => {
              setSellerLookup(event.target.value.trim());
              setSellerError("");
            }}
            placeholder="0x"
          />
        </Field>
        <Button type="submit" variant="secondary" className="w-full">Open seller profile</Button>
      </form>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Dashboard</p>
          <h1 className="display-title mt-1">Your checkouts</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Your MUSD checkouts, from funding to settlement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink">
            {protocol.chain.id === VERIFIED_TESTNET.chainId ? <MezoMark /> : null}
            <span className={protocol.now === undefined ? "size-2 rounded-full bg-line" : "live-dot"} aria-hidden />
            {protocol.chain.name}
          </span>
          <Button href="/create">Create checkout</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/create" className="rounded-[28px] border border-line bg-[#f3f8ea] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Milestones</p>
          <h2 className="mt-2 text-lg font-semibold">Stage a payment</h2>
          <p className="mt-2 text-sm text-muted">One funded agreement per stage.</p>
        </Link>
        <Link href="/agents" className="rounded-[28px] border border-line bg-[#f3f8ea] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Agents</p>
          <h2 className="mt-2 text-lg font-semibold">Set a spending cap</h2>
          <p className="mt-2 text-sm text-muted">Let another address fund for you, up to a cap.</p>
        </Link>
        {wallet ? (
          <Link href={`/sellers/${wallet}`} className="rounded-[28px] border border-line bg-[#f3f8ea] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Seller profile</p>
            <h2 className="mt-2 text-lg font-semibold">Your completed checkouts</h2>
            <p className="mt-2 text-sm text-muted">Completed checkouts and receipts. No rating.</p>
          </Link>
        ) : (
          <div className="rounded-[28px] border border-line bg-[#f3f8ea] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Seller profile</p>
            <h2 className="mt-2 text-lg font-semibold">Public history</h2>
            <p className="mt-2 text-sm text-muted">Connect, or look up an address below.</p>
          </div>
        )}
      </div>

      {!protocol.escrow.address ? <ErrorPanel title="The escrow contract address is not configured." detail="Dashboard totals stay hidden until a deployed contract is configured. Nothing here is sample activity." /> : null}
      {!wallet && protocol.escrow.address ? <EmptyState title="Connect a wallet to see your checkouts." copy="You can still open a checkout link someone shared with you."><Button href="/how-it-works" variant="secondary">How it works</Button></EmptyState> : null}

      {wallet && protocol.escrow.address ? (
        <>
          {list.isError ? <ErrorPanel title="The agreement list could not be read." detail="This is not an empty account." onRetry={() => void list.refetch()} /> : null}
          {list.isLoading ? <div className="grid gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-[28px]" />)}</div> : null}
          {ready ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Awaiting action" value={protocol.now === undefined ? "—" : String(actionCount)} highlight={actionCount > 0} index={0} />
                <Metric label="Funds in escrow" value={formatMusd(secured)} index={1} />
                <Metric label="Completed" value={String(completed)} index={2} />
                <Metric label="Disputed" value={String(disputed)} index={3} />
              </div>
              <p className="text-xs text-faint">
                {list.isFetching ? <span className="mr-2 inline-flex items-center gap-2"><span className="live-dot" aria-hidden />Updating</span> : null}
                {list.truncated ? `Totals use the ${limit} most recent agreements, not the full history.` : "Totals use every agreement found on the configured contract."} {protocol.now === undefined ? "Awaiting a network timestamp before action counts are shown." : null}
              </p>
              {actionCount > 0 && protocol.now !== undefined ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-[28px] bg-[#e7f8d4] px-5 py-4 text-left"
                  onClick={() => { setFilter("Needs my action"); setPage(0); }}
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-brand">
                    <span className="live-dot" aria-hidden />
                    {actionCount === 1 ? "1 checkout is waiting on you" : `${actionCount} checkouts are waiting on you`}
                  </span>
                  <span className="text-sm font-semibold text-brand">Review</span>
                </button>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <div className={cn("gap-6", wallet && protocol.escrow.address ? "grid items-start lg:grid-cols-[minmax(0,1fr)_300px]" : "space-y-6")}>
        {wallet && protocol.escrow.address ? (
          <div className="space-y-4">
            {list.isLoading ? <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-40 rounded-[28px]" />)}</div> : null}
            {ready ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((item) => (
                    <FilterChip key={item} active={filter === item} onClick={() => { setFilter(item); setPage(0); }}>
                      {item}{item === "Needs my action" && actionCount > 0 && protocol.now !== undefined ? ` · ${actionCount}` : ""}
                    </FilterChip>
                  ))}
                </div>
                <input className={`${controlClass} py-2.5`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search title or agreement id" aria-label="Search agreements" />
                {visible.length === 0 ? (
                  <EmptyState
                    title={mine.length === 0 ? "Your first protected checkout starts here." : "Nothing matches this view."}
                    copy={mine.length === 0 ? "Create an agreement or open a checkout link someone shared with you." : "Try another filter or clear the search."}
                  >
                    {mine.length === 0 ? (
                      <>
                        <Button href="/create">Create checkout</Button>
                        <Button href="/how-it-works" variant="secondary">How it works</Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={() => { setFilter("All"); setQuery(""); setPage(0); }}>Clear filters</Button>
                    )}
                  </EmptyState>
                ) : (
                  <ul className="space-y-3">
                    {visible.map((escrow, index) => (
                      <li key={`${escrow.contractAddress}-${escrow.id.toString()}`}>
                        <EscrowFeedItem escrow={escrow} wallet={wallet} now={protocol.now} index={index} />
                      </li>
                    ))}
                  </ul>
                )}
                {filtered.length > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <Button variant="ghost" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                    <span className="text-faint">Page {page + 1} of {pages}</span>
                    <Button variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
                  </div>
                ) : null}
                {list.truncated ? <Button variant="secondary" onClick={() => setLimit((value) => value + 500)}>Load earlier agreements</Button> : null}
              </>
            ) : null}
          </div>
        ) : null}
        <div className={wallet && protocol.escrow.address ? "lg:sticky lg:top-[calc(var(--app-header)+1rem)]" : undefined}>
          {lookupCard}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, index, highlight }: { label: string; value: string; index: number; highlight?: boolean }) {
  return (
    <Card className={cn("enter", highlight && "!border-transparent !bg-[#e7f8d4]")} style={{ animationDelay: `${index * 70}ms` }}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className="num display mt-3 text-3xl leading-none">{value}</p>
    </Card>
  );
}

function EscrowFeedItem({ escrow, wallet, now, index }: { escrow: EscrowModel & { contractAddress?: Address }; wallet: Address; now?: number; index: number }) {
  const seller = sameAddress(escrow.seller, wallet);
  const buyer = sameAddress(escrow.buyer, wallet);
  const role = seller ? "Seller" : buyer ? "Buyer" : "Resolver";
  const counterparty = seller ? escrow.buyer : escrow.seller;
  const hot = requiresUserAction(escrow, wallet, now);
  const title = escrow.metadata?.title ?? `Agreement ${escrow.id.toString()}`;
  const style = { animationDelay: `${Math.min(index, 7) * 55}ms` } as CSSProperties;
  return (
    <article className={cn("tx-card enter", hot && "is-hot")} style={style}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            {hot ? <span className="live-dot" aria-hidden /> : null}
            {role}
            {hot ? <span className="font-sans text-xs font-semibold normal-case tracking-normal text-brand">Needs you</span> : null}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
          {escrow.metadata?.plan ? <p className="mt-1 text-sm text-brand">Milestone {escrow.metadata.plan.index} of {escrow.metadata.plan.count}: {escrow.metadata.plan.label}</p> : null}
          <p className="num mt-1 text-xs text-faint">#{escrow.id.toString()}</p>
        </div>
        <div className="text-right">
          <p className="num display text-3xl leading-none">{formatMusd(escrow.amount)}</p>
          <p className="mt-1 text-xs font-semibold text-muted">MUSD</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <StatusBadge state={escrow.state} />
        <p className="text-xs text-faint">Delivery {now ? formatRelative(escrow.deliveryDeadline, now) : "—"}</p>
      </div>
      <div className="mt-4">
        <ProgressRail state={escrow.state} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Counterparty <span className="num text-ink">{shortAddress(counterparty)}</span> <CopyButton value={counterparty} label="Copy" />
        </p>
        <div className="flex flex-wrap gap-2">
          <Button href={escrowPath("receipt", escrow.id, escrow.contractAddress)} variant="secondary">Receipt</Button>
          <Button href={escrowPath("escrows", escrow.id, escrow.contractAddress)} variant="secondary">Open agreement</Button>
        </div>
      </div>
    </article>
  );
}

function matches(escrow: EscrowModel, filter: Filter, query: string, wallet?: string, now?: number) {
  const text = `${escrow.metadata?.title ?? ""} ${escrow.id.toString()}`.toLowerCase();
  if (query && !text.includes(query.toLowerCase())) return false;
  if (filter === "Needs my action") return requiresUserAction(escrow, wallet as `0x${string}` | undefined, now);
  if (filter === "As buyer") return sameAddress(escrow.buyer, wallet);
  if (filter === "As seller") return sameAddress(escrow.seller, wallet);
  if (filter === "Completed") return escrow.state === "Released" || escrow.state === "Refunded" || escrow.state === "Cancelled" || escrow.state === "Split";
  if (filter === "Disputed") return escrow.state === "Disputed";
  return true;
}
