# RELAY guide

RELAY is a non-custodial checkout for MUSD on Mezo Testnet. A seller publishes an agreement. A buyer, or an agent the buyer has capped, deposits the exact MUSD amount into the escrow contract. The contract holds the tokens until the buyer releases them, a missed delivery is refunded, the review window finalizes payment to the seller, or the named resolver settles a dispute.

The website prepares transactions and reads the chain. It does not hold funds, and it has no key that can withdraw them.

This software has not been independently audited. Tests are not an audit. Mainnet is off.

## What you can do

- Publish one payment, or a plan of two to five milestones. Each milestone is its own agreement.
- Read an agreement before connecting a wallet.
- Fund the exact amount in one confirmation on the current escrow, or with a separate approval on an older escrow.
- Borrow MUSD against testnet BTC, or swap testnet BTC for MUSD, when the buyer is short.
- Submit delivery, release, refund, finalize, dispute, or split.
- Let another wallet fund up to a cap, or submit delivery and nothing else.
- Read receipts, seller history, fees, and a live activity feed.

## What the app will not do

- It will not judge whether the work is acceptable.
- It will not credit MUSD sent directly to the contract address. There is no rescue function.
- It will not move escrow funds into a trove, a swap, the Stability Pool, or an Earn position. Those actions use the connected wallet's own MUSD.
- It will not run on Mezo Mainnet. The deploy script refuses chain ID 31612.
- It will not invent an Earn APR. The savings vault was not found on testnet, so the receipt shows LP and gauge balances only.

## The three roles

Every agreement stores three addresses. Those roles do not swap after creation.

| Role | What that address can do |
| --- | --- |
| Seller | Creates the agreement, submits delivery, and can cancel it before it is funded. After the funding deadline, anyone can cancel an agreement that is still unfunded. |
| Buyer | Funds, releases, refunds a missed delivery, and can raise a dispute. On an open link, the first allowed funder becomes the buyer. |
| Resolver | Does nothing during a normal payment. After a dispute, only this address can pay the seller, refund the buyer, or split the amount. |

The resolver cannot be the seller or the named buyer. The seller and the resolver cannot fund an open agreement.

Two extra permissions are optional:

- A funding agent can fund agreements that already name the buyer, up to a remaining MUSD cap. The agent does not become the buyer and cannot release, refund, or dispute.
- A delivery agent can submit the seller's evidence and cannot settle the agreement.

## Network

| | Mezo Testnet | Mezo Mainnet |
| --- | --- | --- |
| Chain ID | 31611 | 31612, not used |
| RPC | `https://rpc.test.mezo.org` | Not used |
| Websocket | `wss://rpc-ws.test.mezo.org` | Not used |
| Gas token | BTC, 18 decimals | Not used |
| Explorer | `https://explorer.test.mezo.org` | Not used |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | Not used |

The testnet token reads as name `Mezo USD`, symbol `MUSD`, and 18 decimals. Gas is BTC. The faucet at `https://faucet.test.mezo.org/` dispenses testnet BTC, not MUSD.

Testnet MUSD is borrowed against testnet BTC, or swapped from testnet BTC. A new trove borrows at least 1,800 MUSD of principal plus the 200 MUSD gas deposit, about 2,000 MUSD of debt. Checkout reads the live minimum from `minNetDebt`.

## Contracts

New checkouts are created on the current escrow. Older agreements stay on the contract that created them. An older deployment does not gain functions that were not in its bytecode. Agreement ids are per contract, so id 1 on an old escrow is not the same agreement as id 1 on a later escrow. Opening an older agreement uses both the id and the contract address: `/checkout/1?escrow=0x...`.

| Contract | Block | What it can do |
| --- | --- | --- |
| `0x069eef42fb0BaffFfFdCd7755e6e21E37299365d` | 16791508 | Current. One-confirmation Permit2 funding, plus every rule below. Sourcify exact match: `https://repo.sourcify.dev/contracts/full_match/31611/0x069eef42fb0BaffFfFdCd7755e6e21E37299365d/` |
| `0x7b31489D0da4b745E26689647FC1514071De3fD4` | 16656468 | Previous. Milestone gate, resolver acceptance, dispute-only resolver fee, review extension, mutual cancel, and delivery agents. Funding is still two transactions. |
| `0x50ab19e57dff6f2De6e8f3A17EF96417f39cB793` | 16655754 | Mutual cancel, delivery agents, 0.50% seller fee, split settlement, and agent budgets. |
| `0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F` | 16652687 | 0.50% seller fee, split settlement, and agent budgets. |
| `0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46` | 16369215 | Split settlement and agent budgets. No protocol fee. |
| `0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087` | 16365683 | Split settlement. No agent budgets. |
| `0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125` | 16358867 | Original checkout. No split and no agent budgets. |

The current fee is 0.50% (`feeBps()` returns 50). It is taken only when MUSD is paid to the seller. Refunds, including a resolver refund and a mutual cancel, send the full amount to the buyer. The three oldest escrows charge no protocol fee. The wallet still shows the BTC network fee. The fee recipient on the current escrow is `0x39B6fd99d31A67475911D9d763B0Bd8323f99685`.

Permit2, used by the one-confirmation fund, is `0x000000000022D473030F116dDEE9F6B43aC78BA3`.

## Pages

| Path | What it is for |
| --- | --- |
| `/` | Product home. |
| `/how-it-works` | Short explanation of the protected payment. |
| `/docs` | The same rules, written for someone reading the contract. |
| `/dashboard` | Agreements for the connected wallet, lookup by id or seller, deadlines inside 24 hours, CSV download, and alerts. |
| `/create` | Create one payment or a milestone plan. Creation does not move MUSD. |
| `/open` | Invoices that still have no buyer. |
| `/checkout/{id}` | The buyer's page. Read it before connecting. |
| `/escrows/{id}` | The seller's management page for that agreement. |
| `/receipt/{id}` | The on-chain result after funding closes, plus Stability Pool, trove, and Earn reads. |
| `/sellers/{address}` | Agreements that name that seller, with released, refunded, disputed, and split counts. |
| `/agents` | Set a funding cap, or allow a delivery agent. |
| `/activity` | Contract events, with a live websocket while the page is open. |
| `/fees` | Indexed seller fees. |
| `/settings` | Chain ID, RPC, gas token, explorer, and escrow address. |
| `/x402` | The official instant MUSD payment. It does not fund an agreement. |

The header inside the app links Dashboard, Create, Open, Agents, Activity, and Fees. Settings is in the mobile bar and the footer.

## Before you start

Use two wallets if you want to walk through a full payment. One wallet can be both seller and resolver only when it is not also the named buyer. A single wallet cannot be the seller and the buyer of the same agreement.

1. Install a wallet that can add a custom network. The header offers **Browser wallet**, and also **Unisat**, **Xverse**, and **OKX** when that extension is installed and exposes an Ethereum provider. If those three are missing, the header says so. A Bitcoin-only build of an extension cannot send Mezo transactions.
2. Connect, then choose **Switch network** if the wallet is not on Mezo Testnet. Settings lists chain ID 31611, the RPC, BTC as the gas token, and the explorer.
3. Request testnet BTC from `https://faucet.test.mezo.org/`. You need BTC for gas even when the payment itself is MUSD.
4. Get testnet MUSD by borrowing or swapping, either inside checkout or at `https://testnet.mezo.org`.

A saved draft on this host is not an agreement. The agreement exists only after the create transaction is confirmed and the contract returns the id.

## Step by step: the seller creates a checkout

Open `/create`. The form has three steps: Payment details, Delivery and review, then Review and create.

### 1. Payment details

- Choose **one payment** or a **milestone plan**.
- For one payment, enter a title of 3 to 80 characters, what you are delivering, and the amount in MUSD. Amounts use 18 decimals and are not rounded.
- For milestones, enter two to five stages. Each stage has its own name, amount, and delivery deadline. Funding one stage does not fund the others. A later stage cannot be funded until the previous stage is released.
- Name a buyer wallet, or leave the link open so the first allowed funder becomes the buyer.
- Write the terms. The text is public and limited to 2,048 bytes. The contract stores the text and a hash of it. If those do not match, checkout refuses to fund.

### 2. Delivery and review

- Set the funding deadline at least five minutes ahead. The contract accepts funding at that timestamp and refuses it one second later. The form's five-minute margin is so the transaction has time to be mined.
- Set the delivery deadline at least one hour after the funding deadline. Both deadlines must fall within 365 days.
- Choose a review window from 15 minutes to 30 days. It starts when delivery is submitted, not when the agreement is created. If nobody releases and nobody disputes before that window ends, anyone can finalize payment to the seller.
- Name a dispute resolver. On a dispute, that address can pay the seller, refund the buyer, or split the amount. Pick it deliberately.
- Optionally set a resolver fee in MUSD. It is paid only when a dispute is settled. A normal release or refund does not pay it. The fee must be smaller than the agreement amount.

### 3. Review and create

Read the summary. Connect in the header if you are not connected, switch to Mezo Testnet, then create. Wait until the receipt is confirmed and the agreement id is shown. Copy the checkout link. A submitted hash alone is not treated as success. If the stored text does not match what you submitted, the page says so. Do not create a second copy until you have checked the explorer.

The buyer can open `/checkout/{id}` without a wallet and read the seller, amount, deadlines, review window, resolver, and terms.

## Step by step: the buyer funds

On the current escrow, a named buyer accepts the resolver before any MUSD moves. An open invoice is accepted by the first successful fund. The seller and the resolver cannot fund an open link.

### Current escrow: one confirmation

When the connected contract exposes `fundWithPermit2`, checkout offers **Sign and fund**.

1. Open the checkout link and read the agreement.
2. Connect a wallet that is not the seller or the resolver, and switch to Mezo Testnet.
3. If the wallet has never allowed Permit2 to move MUSD, choose **Allow Permit2 once**. That approval is for the Permit2 contract, not for the escrow. It is not repeated for the next invoice.
4. Choose **Sign and fund**. The wallet asks for a Permit2 signature, then one transaction pulls the exact amount into escrow.
5. Wait for the confirmed state **Funds secured**. Refresh if the receipt is slow. Do not send a second funding transaction because a receipt timed out. Open the explorer link first.

The contract rejects a token that delivers a different balance than the amount on the agreement. A direct transfer to the escrow address does not fund it and cannot be withdrawn.

### Older escrows: two transactions

Agreements created before the current deployment do not have Permit2 funding. Checkout keeps the two-step buttons.

1. Choose **Approve MUSD**. The approval is the exact amount. It does not send the tokens.
2. Choose **Fund escrow**. That second transaction pulls the approved amount into the contract.

An agent fund on any escrow still uses the buyer's existing approval of the escrow. Permit2 does not replace that path.

### If the buyer does not have enough MUSD

Checkout shows the token balance and the shortfall.

- **Swap.** The checkout panel quotes BTC to MUSD on the testnet basic pool `0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9` through router `0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9`. Approve BTC for the swap if asked, then swap. The output lands in the wallet. You still fund the agreement afterward. The swap uses a non-zero minimum output.
- **Borrow.** Checkout can open a trove, add collateral and borrow, or withdraw MUSD from an existing trove through BorrowerOperations `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`. A new trove must meet Mezo's minimum debt. The button stays off when the resulting collateral ratio would fall below 150%, or when the Skip BTC/USD round is more than an hour old or differs from PriceFeed by more than 2%. The panel shows collateral, debt, the current ratio, the projected ratio, the borrowing fee, and the interest rate. Liquidation uses TroveManager's minimum collateral ratio. Recovery mode is the system total collateral ratio below the critical ratio.

Borrowing and swapping do not move tokens that are already inside the escrow.

## Step by step: delivery, release, and refund

### Deliver

While the agreement is funded, and at or before the delivery deadline, the seller submits a note of up to 800 bytes, an optional `https` link, and an optional file. The contract stores the text and a hash of that text. The hash does not prove the work is acceptable. A link can change or disappear. A file is stored by its CIDv1 and is called pinned only when a configured IPFS service accepts it.

A delivery agent the seller has allowed can submit the same evidence and cannot release, refund, dispute, or cancel.

Submitting delivery starts the review window and moves the agreement to **Review required**. After a valid delivery, the missed-delivery refund and a pending mutual cancel are no longer available.

### Release

During the review window, the buyer chooses **Approve delivery and release funds**. On the current escrow the seller receives the amount minus 0.50%. The fee recipient receives the fee. Example: 4.00 MUSD released pays the seller 3.98 MUSD and the fee recipient 0.02 MUSD. A very small amount can round the fee to zero because the fee is integer division.

### Refund after a missed deadline

If the delivery deadline passes and nothing was submitted, the buyer can refund the full amount. At the exact delivery deadline the seller can still deliver, and the refund is not open yet. Refunds are whole. No seller fee is charged.

### Finalize after review

If the review deadline passes with no release and no dispute, anyone can finalize payment to the seller. The caller is not paid. A buyer who does not want that result must release or dispute before the deadline.

The buyer and the seller can agree to a later review deadline, up to 30 days after delivery. One party proposes. The other accepts.

### Mutual cancel

While the agreement is funded and nothing has been delivered, either party can propose a full refund. Only the other party can accept it. The buyer receives the full amount. The proposer can withdraw the request, which leaves the funds in escrow.

### Cancel before funding

The seller can cancel an unfunded agreement. After the funding deadline, anyone can cancel an agreement that is still unfunded. Cancelled agreements cannot be funded.

## Step by step: a dispute

A dispute freezes release, refund, and automatic finalizing. RELAY does not decide who is right.

1. After delivery, and at or before the review deadline, the buyer or the seller raises a dispute.
2. The reason is public, limited to 280 bytes, and can include a file content id. Do not put secrets, credentials, or personal data on chain.
3. The named resolver connects and settles once:
   - full payment to the seller,
   - full refund to the buyer, or
   - a split, where the seller receives a stated part and the buyer receives the rest.

Neither side can receive the full amount through the split. Use a full settlement for that. A resolver fee, if the seller set one, is paid only on this settlement. The current testnet escrow supports splits. An older deployment that does not will hide the split action.

`Paid to seller`, `Refunded to buyer`, `Cancelled`, and `Split settlement` are final.

## State machine

```text
Created   -> Funded      buyer, open funder, or allowed agent
Created   -> Cancelled   seller while unfunded, or anyone after the funding deadline
Funded    -> Delivered   seller, or a seller-approved delivery agent
Funded    -> Refunded    buyer after a missed delivery, or both parties by mutual cancel
Delivered -> Released    buyer during review, or anyone after review if nobody disputed
Delivered -> Disputed    buyer or seller during review
Disputed  -> Released    resolver, full payment to the seller
Disputed  -> Refunded    resolver, full refund to the buyer
Disputed  -> Split       resolver, seller receives a stated part and the buyer the rest
```

Comparisons on the contract:

| Action | When it is allowed |
| --- | --- |
| Fund | timestamp `<=` funding deadline |
| Submit delivery | timestamp `<=` delivery deadline |
| Refund after a missed delivery | timestamp `>` delivery deadline |
| Buyer release or dispute | timestamp `<=` review deadline |
| Anyone finalizes to the seller | timestamp `>` review deadline, and nobody disputed |

## Step by step: milestones

1. On `/create`, choose a milestone plan of two to five stages.
2. Give each stage its own amount and delivery deadline. The stages share the seller, buyer, and resolver, and each one is a separate agreement.
3. After creation, fund the confirmed stages in order from the funding link. One approval can cover the total. A failed stage stops the sequence.
4. Deliver and release stage 1 before stage 2 can be funded. The contract checks that the predecessor is released.

## Step by step: agents

Open `/agents`.

### Funding agent

1. The buyer enters the agent's address and a remaining MUSD cap. Setting the cap to zero revokes that agent. The agent cannot be the buyer's own address.
2. The cap does not approve MUSD. The buyer still approves the escrow, or, on the current escrow, completes the Permit2 allowance that `fundEscrow` does not use. Agent funding calls `fundEscrowAsAgent` and spends the buyer's approval of the escrow.
3. Each successful agent fund lowers the cap by the agreement amount.
4. The agent opens an agreement that already names the buyer and chooses **Fund with agent budget**. Open invoices cannot be agent-funded, because they have no stored buyer yet.
5. The seller, the resolver, and the buyer cannot call the agent fund function. The agent cannot release, refund, or dispute.

If the connected escrow was deployed before `agentAllowance`, the form stays off. A revert is not treated as a saved budget.

### Delivery agent

The seller allows an address to submit delivery. That address cannot release, refund, dispute, or cancel. This permission is separate from the funding cap.

## After the seller is paid

The receipt is `/receipt/{id}`. It reads the contract. It does not keep a separate balance.

When the connected wallet is the seller and the agreement is paid or split:

- **Stability Pool.** The pool is `0x1CCA7E410eE41739792eA0A24e00349Dd247680e`. The seller can deposit that receipt's proceeds when the wallet holds them, read the compounded deposit, withdraw it, and see BTC gained from liquidations. That gain is not a yield. A liquidation can reduce the deposit. The escrow balance is not deposited.
- **Trove.** The seller can repay or close the connected wallet's own trove with that wallet's MUSD. This does not move tokens held by the escrow.
- **Earn.** The panel reads the MUSD/BTC LP balance at `0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9` and the staked balance on the gauge returned by the testnet voter `0x72F8dd7F44fFa19E45955aa20A5486E8EB255738`. If both are zero, it says there is no Earn position. It does not show an APR. It says the savings vault was not found on testnet.

## Activity, fees, and records

`/activity` lists escrow events from block 16358867, the first deployment, through the latest block. While that page is open it also subscribes to `wss://rpc-ws.test.mezo.org`. New logs refresh the list. If the socket fails, the page says the live feed is disconnected and keeps the saved index. A serverless function cannot hold that socket between requests, so the hosted index is caught up once a day at 04:00 UTC, which is 06:00 in Africa/Cairo. A failed scan is an error with retry, not an empty history. The newest events are shown. Older agreements can still be opened by id.

New indexed events can be posted to a signed `https` webhook configured on the host.

`/fees` sums indexed seller fees. `/dashboard` lists the connected wallet's agreements and deadlines inside 24 hours. A seller page lists agreements for one address. A finished agreement can be copied into a new create form.

## Machine-readable checkout

There are two different HTTP 402 responses. Do not mix them.

| Route | What it pays |
| --- | --- |
| `GET /api/x402/agreements/{id}` | While funding is open, returns scheme `relay-escrow`. The body is `approve` and `fundEscrow` calldata for that agreement. Another app can sign it and `POST /api/x402/agreements/{id}/settle`. RELAY broadcasts the signed transaction, or accepts a transaction hash, and reports success only when the receipt succeeded and the agreement is no longer awaiting funds. |
| `GET /api/x402/instant` and `/x402` | The official exact scheme on `eip155:31611`, price `$0.001`, facilitator `https://facilitator.vativ.io`. It pays the configured merchant in `X402_PAY_TO`. It does not fund RelayEscrow. The route stays unavailable until that merchant address is set. |

A direct MUSD transfer still does not fund an agreement.

## Limits

| Limit | Value |
| --- | --- |
| Review window | 15 minutes to 30 days |
| Funding deadline in the form | At least 5 minutes ahead |
| Delivery deadline | At least 1 hour after the funding deadline, and within 365 days |
| Terms text | 2,048 bytes |
| Delivery note | 800 bytes |
| Dispute reason | 280 bytes |
| Milestone plan | 2 to 5 stages |
| Token decimals | 18 |
| Seller fee on the current escrow | 0.50% of a seller payout |

## Run it yourself

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local`.

`.env.example` already points at the current Mezo Testnet escrow. An invalid explicit address does not fall back to a placeholder. The same public values are the code defaults, so a host build still resolves the testnet contracts when those variables are unset.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CHAIN_ENV` | `testnet` (default) or `local` |
| `NEXT_PUBLIC_MEZO_TESTNET_RPC_URL` | Testnet RPC |
| `NEXT_PUBLIC_MUSD_TESTNET_ADDRESS` | Testnet MUSD |
| `NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS` | Current escrow. New checkouts are created here. |
| `NEXT_PUBLIC_ESCROW_LEGACY_ADDRESS` | Earliest escrow that still holds older agreements |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | Blockscout origin |
| `NEXT_PUBLIC_ESCROW_DEPLOY_BLOCK` | Earliest block used for activity indexing. Keep this at `16358867`. |
| `NEXT_PUBLIC_LOCAL_RPC_URL` | Local Hardhat RPC when the chain env is `local` |
| `NEXT_PUBLIC_LOCAL_MUSD_ADDRESS` | Local mock token. Required in local mode. |
| `NEXT_PUBLIC_LOCAL_ESCROW_ADDRESS` | Local escrow. Required in local mode. |
| `X402_PAY_TO` | Merchant address for the official instant payment. Never the escrow and never a private key. |
| `MEZO_TESTNET_RPC_URL` | Deploy script RPC. Server-side only. |
| `MUSD_ADDRESS` | Deploy script token. Server-side only. |
| `DEPLOYER_PRIVATE_KEY` | Deploy script key. Never commit it and never prefix it with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Authorizes the daily activity index call. |
| `RELAY_INDEXER_TOKEN` | Authorizes indexer writes. |
| `RELAY_WEBHOOKS` | Signed `https` endpoints for new events. |
| `PINATA_JWT` or `IPFS_API_URL` | Optional. Without one, delivery files are stored by content id on this host. |

Useful commands:

```bash
npm run dev
npm run compile
npm run test:contracts
npm test
npm run typecheck
npm run lint
npm run build
npm run read:musd
npm run test:e2e
npm run check
```

`npm run check` runs compile, contract tests, typecheck, lint, unit tests, and the production build. `npm run test:e2e` runs a full protected payment and a separate refund on Hardhat's local chain. It is not a Mezo Testnet run. `npm run compile` writes `src/lib/contracts/relayEscrowAbi.ts` from the Hardhat artifact.

To deploy a new escrow, use a dedicated testnet key and `npm run deploy:testnet`. The script checks chain ID 31611, refuses chain ID 31612, checks that the token is MUSD with 18 decimals, and checks the required rules before it writes `deployments/mezo-testnet.json`. `RelayEscrow` is not upgradeable. Copy the new address into `NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS`, keep the index start at block 16358867, and leave the previous address in the legacy list. Do not put `DEPLOYER_PRIVATE_KEY` on the host.

Vercel builds with `npm run build`. The activity index is scheduled once a day at 04:00 UTC. A Hobby account rejects a faster schedule. Render can run the same app from `render.yaml` with `npm start`. Next.js inlines `NEXT_PUBLIC_` variables at build time, so changing them requires a new deployment.

## A short demo with two wallets

1. The seller connects, switches to Mezo Testnet, and creates a checkout.
2. Wait for the agreement id. Copy `/checkout/{id}`.
3. The buyer opens that URL without connecting, reads the terms, resolver, and deadlines, then connects.
4. On the current escrow, the buyer accepts the resolver if asked, allows Permit2 once if asked, then chooses **Sign and fund**. On an older escrow, the buyer approves MUSD and then funds.
5. Confirm the funded state from the contract read.
6. The seller submits a short delivery note and an optional `https` link.
7. The buyer releases. The seller receives the amount minus 0.50% on the current escrow.
8. For the refund path, fund a second agreement and do not deliver. After the delivery deadline, the buyer refunds the full amount.

Dispute path: after delivery, either party raises a dispute before the review deadline. The resolver wallet then pays one side, or splits the amount.

Agent path: the buyer opens `/agents`, sets a cap for a second wallet, and approves the escrow for at least that amount. The agent wallet funds an agreement that already names the buyer.

## Safety

- The resolver is chosen by the seller and shown before funding. On a disputed agreement, that address can pay either side in full.
- Buyers must release or dispute before the review deadline if they do not want finalizing to the seller.
- Evidence and dispute text are public.
- A link in the delivery note can change or disappear. The hash covers only the text that was submitted.
- Direct transfers to the escrow are not credited.
- The app does not send a second state-changing transaction because a receipt timed out.
- Dashboards read a bounded set of recent agreements. Older agreements can still be opened by id and contract address.
- Reentrancy is guarded. The production asset is the configured MUSD contract.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Unsupported network | Switch to Mezo Testnet from the header, or add it from Settings. |
| Unisat, Xverse, or OKX is missing | The extension is not installed, or this browser build does not expose an Ethereum provider. Use the browser wallet. |
| Escrow actions disabled | The escrow address is missing, or the connected contract does not have that function. A missing address is intentional. |
| Sign and fund is not offered | This agreement is on an older escrow. Use Approve MUSD, then Fund escrow. |
| Agent budget button stays off | The connected deployment has no `agentAllowance` function. |
| Not enough MUSD | Borrow or swap inside checkout. The faucet does not dispense MUSD. |
| Not enough gas | Gas is BTC on Mezo, not ETH and not MUSD. |
| Agreement details could not be verified | Funding stays disabled when the stored text does not match the on-chain hash. |
| Transaction submitted but not confirmed | Open the explorer link. Do not immediately send a duplicate. |
| Live feed is disconnected | `/activity` keeps the saved index. The daily catch-up still runs when nobody has the page open. |
| No Earn position | The connected seller has no MUSD/BTC LP and nothing staked in the gauge. That is a real read, not a hidden balance. |
| Local contract tests | `npm run test:contracts` does not need a funded wallet or a testnet key. |

## Where the rules live

| Piece | File |
| --- | --- |
| Escrow contract | `contracts/RelayEscrow.sol` |
| Contract tests | `test/RelayEscrow.ts` |
| Current addresses | `src/lib/chain/config.ts` and `deployments/mezo-testnet.json` |
| Mezo system addresses | `src/lib/mezo/system.ts` |
| Buyer and seller actions | `src/lib/escrow/policy.ts` |
| In-app documentation | `src/lib/docs-content.ts` |
| Wallet connectors | `src/lib/chain/bitcoin-wallets.ts` and `src/components/wallet.tsx` |
| Developer setup | `README.md` |
