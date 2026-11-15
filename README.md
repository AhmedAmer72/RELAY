# RELAY

**Secure the deal. Move the value.**

RELAY is a non-custodial checkout for MUSD on Mezo. A seller publishes an agreement. A buyer, or an agent the buyer has capped, deposits the exact MUSD amount into `RelayEscrow`. The contract holds the tokens until the buyer releases them, a missed delivery is refunded, the review window finalizes payment to the seller, or the named resolver settles a dispute in full or as a split.

The website prepares transactions and reads the chain. It does not custody funds, and it has no key that can withdraw them.

The step-by-step guide for sellers, buyers, agents, and operators is [docs/GUIDE.md](docs/GUIDE.md).

This repository was specified as MEZO LOOP / LoopGuard and is shipped as RELAY. Mezo and MUSD keep their protocol names.

## Status

| | |
| --- | --- |
| Network | Mezo Testnet, chain ID 31611 |
| Current escrow | [`0x069eef42fb0BaffFfFdCd7755e6e21E37299365d`](https://explorer.test.mezo.org/address/0x069eef42fb0BaffFfFdCd7755e6e21E37299365d) |
| Deployment block | 16791508 |
| Asset | MUSD, 18 decimals, Mezo Testnet only |
| Mainnet | Disabled. The deploy script refuses chain ID 31612. |
| Audit | This software has not been independently audited. Tests are not an audit. |
| Protocol fee | 0.50% of a seller payout on the current escrow. Refunds are whole. The wallet still shows the BTC network fee. |

New checkouts are created on the current escrow. That deployment supports split settlement and agent budgets. Earlier deployments stay readable so existing agreements are not dropped. They do not gain functions that were not in their bytecode.

| Contract | Block | What it can do |
| --- | --- | --- |
| `0x069eef42fb0BaffFfFdCd7755e6e21E37299365d` | 16791508 | Current. One-confirmation Permit2 funding, plus every rule from the previous escrow. |
| `0x7b31489D0da4b745E26689647FC1514071De3fD4` | 16656468 | Previous. Milestone gate, resolver acceptance, dispute-only resolver fee, review extension, mutual cancel, and delivery agents. No Permit2 funding. |
| `0x50ab19e57dff6f2De6e8f3A17EF96417f39cB793` | 16655754 | Mutual cancel, delivery agents, 0.50% seller fee, split settlement, and agent budgets. |
| `0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F` | 16652687 | 0.50% seller fee, split settlement, and agent budgets. No mutual cancel and no delivery agents. |
| `0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46` | 16369215 | Split settlement and agent budgets. No protocol fee. |
| `0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087` | 16365683 | Split settlement. No agent budgets. |
| `0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125` | 16358867 | Original checkout. No split and no agent budgets. |

Agreement ids are per contract. Opening an older agreement uses the contract address as well as the id, so id 1 on the original escrow is not confused with a later id 1.

## Wave 2

Wave 1 already had partial dispute settlement, milestone checkouts of two to five agreements, seller history and receipts, the x402 settle route, and a contract cap on agent spending. Those flows are unchanged.

This resubmission adds the Mezo depth that was still open, and each new chain action below has a receipt:

- The fee escrow `0xE8814DC8…753F` charges 0.50% only when the seller is paid. Refunds stay whole. Its source is an exact [Sourcify match](https://repo.sourcify.dev/contracts/full_match/31611/0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F/). The same 0.50% seller fee is on the current escrow `0x069eef…365d`, whose source is an exact [Sourcify match](https://repo.sourcify.dev/contracts/full_match/31611/0x069eef42fb0BaffFfFdCd7755e6e21E37299365d/). The Blockscout HTTP API did not return a verification record for that address when this was checked. `feeBps()` on that contract returns 50. The recipient is `0x39B6fd99d31A67475911D9d763B0Bd8323f99685`.
- Checkout can borrow MUSD from an existing Mezo trove through `BorrowerOperations`, then fund. The borrow stays off when the resulting collateral ratio would fall below 150%.
- The seller receipt can deposit a payout in the Stability Pool at `0x1CCA7E410eE41739792eA0A24e00349Dd247680e`, and withdraw that wallet's own compounded deposit with `withdrawFromSP`. One withdrawal of 1 MUSD returned to the seller that had deposited: [`0x3413d5a9f8af88726573888b29e8bfefd1ebb0304caa91a9cda76715c4d10443`](https://explorer.test.mezo.org/tx/0x3413d5a9f8af88726573888b29e8bfefd1ebb0304caa91a9cda76715c4d10443). The pool deposit was zero afterward. Escrow balances were not moved.
- Activity is read in chunks from the first escrow block, 16358867, through the latest block. A failed chunk stays an error with retry. It is not shown as an empty history.

## Checkout depth

The current escrow adds two settlement paths that the previous fee escrow does not have. Older agreements stay on their original contracts, and these buttons stay off there.

- A funded agreement can be refunded in full when one party proposes and the other accepts. The refund is the whole amount. No seller fee is charged. Receipt: [`0x79d31e9051180978de25426be472dcd652116b82da5f752c48d952afedad8a8b`](https://explorer.test.mezo.org/tx/0x79d31e9051180978de25426be472dcd652116b82da5f752c48d952afedad8a8b).
- A seller can allow a delivery agent. That address can submit delivery and cannot release, refund, dispute, or cancel. Receipt: [`0xd8aa52e56943b5458497c43554df908d85b558b4ec85f65ced9f6b661ae90dc4`](https://explorer.test.mezo.org/tx/0xd8aa52e56943b5458497c43554df908d85b558b4ec85f65ced9f6b661ae90dc4).
- The receipt can repay or close the connected wallet's own Mezo trove, and it shows Stability Pool BTC gained from liquidations.
- A milestone plan can be funded in order from `/create?fund=`. One approval covers the total, and a failed stage stops the sequence.
- A delivery file is stored by its CIDv1. It is described as pinned only after Pinata or a configured IPFS API accepts it.
- `/fees` sums indexed seller fees. `/dashboard` lists deadlines inside 24 hours. Sellers can save a signed draft on this host. Activity is served from an index that starts at block 16358867, and new events can be posted to an https webhook.

Source match for the current escrow: [Sourcify full match](https://repo.sourcify.dev/contracts/full_match/31611/0x069eef42fb0BaffFfFdCd7755e6e21E37299365d/).

## Deal rules

The current escrow adds four rules. Older deployments do not have them, and those buttons stay off there.

- A later milestone cannot be funded until its predecessor is released. The second-stage fund is [`0x90ef98a3b49a4a1d56892692af21a5d38542f8b0deb0e42ade6485186a0dc6ba`](https://explorer.test.mezo.org/tx/0x90ef98a3b49a4a1d56892692af21a5d38542f8b0deb0e42ade6485186a0dc6ba).
- A named buyer accepts the resolver before funding. That acceptance is [`0x0c7e9feef419935a4a8c0e40b9ac1da55fb6d88f9803ac8b5b8a0b663716be9f`](https://explorer.test.mezo.org/tx/0x0c7e9feef419935a4a8c0e40b9ac1da55fb6d88f9803ac8b5b8a0b663716be9f). An open invoice is accepted by the first fund.
- The buyer and seller can move the review deadline later, up to 30 days after delivery. The accepted extension is [`0x1dfd113473a76a8b2e999f75036741a1f50f31a5a77ea221965f955f1fa8b505`](https://explorer.test.mezo.org/tx/0x1dfd113473a76a8b2e999f75036741a1f50f31a5a77ea221965f955f1fa8b505).
- A resolver fee is paid only when a dispute is settled. Release and refund do not pay it. The settlement that paid the resolver is [`0x998c48d1c916b9eed979a6c4d10848d67427c4a5a50c058124c5709fffd6c31d`](https://explorer.test.mezo.org/tx/0x998c48d1c916b9eed979a6c4d10848d67427c4a5a50c058124c5709fffd6c31d).

Seller pages count released, refunded, disputed, and split outcomes. `/open` lists invoices with no buyer. A finished agreement can be copied into a new create form. The dashboard can download a CSV and register an alert for that wallet's agreements. A dispute reason can include a file content id.

## What a user can do

A buyer can read the seller, amount, deadlines, review window, and resolver before connecting a wallet.

- **Create.** One payment, or a milestone plan of two to five stages. Each stage is its own agreement, with its own amount and delivery deadline. After creation, the buyer can fund the confirmed stages in order. A saved draft is not the on-chain agreement.
- **Buyer.** Name a wallet, or leave the link open. The first allowed funder of an open link becomes the buyer. The seller and the resolver cannot fund an open agreement.
- **Fund.** Approve MUSD when the allowance is short, then deposit the exact amount. The contract rejects a token that delivers a different balance. If the buyer is short, checkout can open or adjust a Mezo trove through `BorrowerOperations` and borrow MUSD against BTC first. A new trove borrows at least Mezo's minimum debt. The button stays off when the wallet cannot post collateral and keep the trove at or above 150%.
- **Seller fee.** The current escrow takes 0.50% when MUSD is paid to the seller. The fee goes to the fee recipient stored on the contract. Refunds send the full amount to the buyer.
- **Merchant reserve.** After a seller payout, the receipt can deposit that MUSD in Mezo's Stability Pool, withdraw the connected wallet's own compounded deposit, and show BTC gained from liquidations. The same receipt can repay or close that wallet's trove. None of these actions move the escrow balance.
- **Mutual cancel.** While an agreement is funded, the buyer or seller can propose a full refund. Only the other party can accept it. The buyer receives the full amount.
- **Deliver.** The seller, or a seller-approved delivery agent, submits a note of up to 800 bytes, an optional link, and an optional file content id. The contract stores the text and a keccak256 hash of it. The hash does not prove the work is acceptable.
- **Release.** The buyer pays the seller the full amount during the review window.
- **Refund.** After the delivery deadline, and only if nothing was submitted, the buyer refunds the full amount.
- **Finalize.** After the review deadline, if nobody disputed, anyone can send the full amount to the seller. The caller is not paid.
- **Dispute.** The buyer or the seller can freeze the agreement during the review window. The reason is public and limited to 280 bytes. Only the stored resolver can then pay one side in full, or split the amount. A split pays the seller a stated part and the buyer the rest. Neither side can receive the full amount through the split.
- **Agent budget.** The buyer sets a remaining MUSD cap for another address. Zero revokes it. The agent funds agreements that already name that buyer, using the buyer's existing MUSD approval. The agent does not become the buyer and cannot release, refund, or dispute. Open invoices cannot be agent-funded. If the connected escrow has no `agentAllowance` function, the form stays off. A revert is not treated as a saved budget.
- **Records.** The dashboard, seller page, receipt, activity feed, and docs all read the contracts. There is no database.

Create limits, enforced by the contract and the form:

- Funding deadline at least five minutes ahead.
- Delivery deadline at least one hour after the funding deadline, and both within 365 days.
- Review window from 15 minutes to 30 days. It starts when delivery is submitted, not when the agreement is created.
- Terms text up to 2,048 bytes. If the stored text does not match the stored hash, funding stays disabled.

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

`Released`, `Refunded`, `Cancelled`, and `Split` are final.

| Action | Who | When |
| --- | --- | --- |
| Fund | Named buyer, first open funder, or allowed agent | `Created`, timestamp `<=` funding deadline |
| Cancel | Seller, or anyone after the deadline | Still unfunded |
| Submit delivery | Seller, or a delivery agent | `Funded`, timestamp `<=` delivery deadline |
| Refund | Buyer | `Funded`, timestamp `>` delivery deadline, no delivery |
| Mutual cancel | Buyer and seller, one proposes and the other accepts | `Funded` |
| Release | Buyer | `Delivered`, timestamp `<=` review deadline |
| Dispute | Buyer or seller | `Delivered`, timestamp `<=` review deadline |
| Finalize to seller | Anyone | `Delivered`, timestamp `>` review deadline, no dispute |
| Settle | Resolver only | `Disputed` |

At the exact delivery deadline the seller can still deliver. The refund opens one second later. At the exact review deadline the buyer can still release and either party can still dispute. Finalizing opens one second later. A dispute stops release, refund, and finalizing.

## Application routes

| Path | Purpose |
| --- | --- |
| `/` | Product introduction and pitch-deck link |
| `/create` | Seller wizard, including milestone plans |
| `/checkout/[id]` | Public agreement. Readable before a wallet is connected. |
| `/escrows/[id]` | Agreement detail, actions, and history |
| `/receipt/[id]` | On-chain receipt |
| `/sellers/[address]` | Agreements that name that seller |
| `/dashboard` | Agreements for the connected wallet, plus lookup by id or seller |
| `/open` | Agreements that do not name a buyer yet |
| `/agents` | Set or revoke an agent spending cap, and allow a delivery agent |
| `/activity` | Indexed contract events from the current and earlier escrows |
| `/fees` | Indexed seller fees for the current fee rate |
| `/how-it-works` | Short rules and questions |
| `/docs` | Contract reference, deployment addresses, and the pitch deck |
| `/docs#pitch-deck` | Mezo Buildathon deck, open or download |
| `/settings` | Network, contract addresses, and the same agent-budget form |

Pass `?escrow=` when the agreement is not on the current contract.

## Integration

Another application can pay a RELAY invoice without using the website buttons.

`GET /api/x402/agreements/{id}`

- While the agreement is `Created` and the funding deadline has not passed, the response is HTTP 402. The body contains the MUSD amount, the escrow address, and the exact calldata for `approve`, `fundEscrow`, and `fundEscrowAsAgent`. It also links to the Mezo testnet app, where a buyer borrows or swaps into MUSD.
- After funding closes, the response is HTTP 200 with the on-chain receipt: state, amount, parties, hashes, and links to the checkout and receipt pages.
- An unknown id returns 404.

`POST /api/x402/agreements/{id}/settle`

```json
{ "signedTransaction": "0x..." }
```

or

```json
{ "txHash": "0x..." }
```

RELAY broadcasts a signed transaction, or reads an existing hash, and accepts it only when the call is an MUSD approval for this escrow or a fund call for this agreement. A successful fund is reported only after the receipt succeeds and the agreement is no longer `Created`. A direct MUSD transfer to the escrow is rejected. Tokens sent directly to the contract are not credited and cannot be rescued.

The server does not hold a key and does not sign on behalf of the buyer.

## Architecture

```text
Browser (Next.js, wagmi, viem)
  -> injected wallet
  -> Mezo Testnet RPC
       -> RelayEscrow    holds MUSD and enforces the state machine
       -> MUSD           the only escrow asset
  -> Blockscout          transaction and address links
```

Agreement text, delivery notes, and dispute reasons are stored on the contract and checked against keccak256 hashes. Activity is read from logs, starting at the earliest escrow deployment, with a bounded lookback. There is no database and no admin role.

## Stack

- Node.js 20 or newer
- Next.js 15, React 19, TypeScript 5.9
- Tailwind CSS 4
- wagmi and viem
- Solidity 0.8.28, EVM `london`, optimizer 200 runs, `viaIR`
- Hardhat 2 and OpenZeppelin Contracts 5
- Vitest and Testing Library

`viaIR` is enabled because agreement creation otherwise hits Solidity's stack limit. The bytecode target remains `london`, which matches the official Mezo Hardhat example.

## Network

Checked on 15 November 2026 against the live testnet RPC and the official docs:

- [Developer environment](https://mezo.org/docs/developers/getting-started/configure-environment/)
- [Contracts and token addresses](https://mezo.org/docs/users/resources/contracts-reference/)
- [MUSD and x402 quickstart](https://mezo.org/docs/developers/getting-started/musd-payments-x402/x402-quickstart/)

| | Mezo Testnet | Mezo Mainnet |
| --- | --- | --- |
| Chain ID | 31611 | 31612 |
| RPC | `https://rpc.test.mezo.org` | Not used by this app |
| Websocket | `wss://rpc-ws.test.mezo.org` | Not used by this app |
| Gas token | BTC, 18 decimals | BTC, 18 decimals |
| Explorer | `https://explorer.test.mezo.org` | `https://explorer.mezo.org` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |

On-chain reads of the testnet token returned name `Mezo USD`, symbol `MUSD`, and decimals `18`. Explorer links use Blockscout paths `/tx/{hash}` and `/address/{address}`.

Mainnet addresses are listed so they are not pasted into the testnet app by mistake. This app does not add Mezo Mainnet.

Testnet MUSD is borrowed against testnet BTC, or swapped inside checkout through the testnet basic router. It is not dispensed by the faucet. The faucet dispenses testnet BTC. A new trove borrows at least 1,800 MUSD of principal plus the 200 MUSD gas deposit, about 2,000 MUSD of debt. Checkout reads the current minimum from `minNetDebt`.

1. Request testnet BTC from [the faucet](https://faucet.test.mezo.org/).
2. Borrow or swap into MUSD at [testnet.mezo.org](https://testnet.mezo.org) while the wallet is on Mezo Testnet.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

`.env.example` already points at the current Mezo Testnet escrow. An invalid explicit address does not fall back to a placeholder. The same public values are the code defaults, so a host build still resolves the testnet contracts when those variables are unset.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CHAIN_ENV` | `testnet` (default) or `local` |
| `NEXT_PUBLIC_MEZO_TESTNET_RPC_URL` | Testnet RPC. Default is the official endpoint. |
| `NEXT_PUBLIC_MUSD_TESTNET_ADDRESS` | Testnet MUSD. Default is the verified address above. |
| `NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS` | Current `RelayEscrow`. New checkouts are created here. |
| `NEXT_PUBLIC_ESCROW_LEGACY_ADDRESS` | Earlier escrow that still holds older agreements. |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | Blockscout origin. Default is the testnet explorer. |
| `NEXT_PUBLIC_ESCROW_DEPLOY_BLOCK` | Earliest block used for activity indexing. |
| `NEXT_PUBLIC_LOCAL_RPC_URL` | Local Hardhat RPC when `CHAIN_ENV=local`. |
| `NEXT_PUBLIC_LOCAL_MUSD_ADDRESS` | Local mock token. Required in local mode. |
| `NEXT_PUBLIC_LOCAL_ESCROW_ADDRESS` | Local escrow. Required in local mode. |
| `MEZO_TESTNET_RPC_URL` | Deploy script RPC. Server-side only. |
| `MUSD_ADDRESS` | Deploy script token. Server-side only. |
| `DEPLOYER_PRIVATE_KEY` | Deploy script key. Never commit it and never prefix it with `NEXT_PUBLIC_`. |

## Commands

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

`npm run check` runs compile, contract tests, typecheck, lint, unit tests, and the production build.

`npm run compile` writes `src/lib/contracts/relayEscrowAbi.ts` from the Hardhat artifact.

`npm run test:e2e` runs the Hardhat lifecycle test for a full protected payment and a separate refund. It uses the escrow on Hardhat's local chain. It is not a Mezo Testnet run.

`npm run read:musd` reads the configured token's name, symbol, and decimals from the testnet RPC.

## Contracts

`contracts/RelayEscrow.sol` is the escrow. Tests live in `test/RelayEscrow.ts` and are loaded by `test/index.js`, because Hardhat only auto-discovers TypeScript tests when the config file itself is TypeScript.

The tests cover creation validation, restricted and open funding, exact token amounts, fee-on-transfer rejection, delivery, buyer release, missed-delivery refund, review-window boundaries, dispute resolution, partial splits, agent budgets, cancellation, escrow isolation, reentrancy, and same-block conflicts.

### Deploy to Mezo Testnet

Use a dedicated testnet key. Do not deploy to mainnet with this script.

```bash
# .env.local or the shell environment
# DEPLOYER_PRIVATE_KEY=0x...
# MUSD_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
npm run deploy:testnet
```

The script checks chain ID 31611, refuses chain ID 31612, and checks that the token symbol is `MUSD` and the decimals are 18. It also requires `partialSettlementSupported()` and a successful `agentAllowance` read before it writes `deployments/mezo-testnet.json`. Copy the new address into `NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS`. Keep `NEXT_PUBLIC_ESCROW_DEPLOY_BLOCK` at the earliest escrow block, `16358867`, so older agreements stay in the activity index. Move the previous address into the legacy list if it still holds agreements.

`RelayEscrow` is not upgradeable. A new function requires a new deployment. Older agreements remain on the contract that created them.

## Hosting

### Vercel

Import this repository. `vercel.json` sets the install command to `npm ci` and the build command to `npm run build`. Use Node 20. Vercel serves the app, so no start command is required. The activity index is scheduled once a day at 04:00 UTC, which is 06:00 in Africa/Cairo. A Hobby account rejects a schedule that runs more often than that. Set `CRON_SECRET` if you want Vercel to authorize that call.

Add the `NEXT_PUBLIC_` variables from `.env.example` before the first production build. Next.js inlines them at build time. Changing them requires a new deployment. Do not put `DEPLOYER_PRIVATE_KEY` on Vercel.

### Render

`render.yaml` is a Blueprint for one Node web service. In the Render dashboard, choose **New → Blueprint** and select this repository. Render runs `npm ci && npm run build`, then `npm start`. The blueprint sets `HOSTNAME` to `0.0.0.0` and the public Mezo Testnet variables. The health check is `/`. Do not put `DEPLOYER_PRIVATE_KEY` on the service.

## Demo flow

Use two wallets on Mezo Testnet.

1. The seller connects, switches to Mezo Testnet, and creates a checkout.
2. Wait until the receipt is confirmed and the agreement id is shown. Copy `/checkout/{id}`.
3. The buyer opens that URL without connecting, reads the terms, resolver, and deadlines, then connects.
4. The buyer approves the exact MUSD amount if asked, then funds the escrow in a second transaction.
5. Confirm the funded state from the contract read. A submitted hash alone is not treated as success.
6. The seller submits a short delivery note and an optional `https` link.
7. The buyer releases the funds. On the current escrow the seller receives the amount minus the 0.50% seller fee. A refund stays whole.
8. For the refund path, fund a second agreement and do not deliver. After the delivery deadline, the buyer refunds.

Dispute path: after delivery, either party raises a dispute before the review deadline. The resolver wallet then pays one side, or splits the amount.

Agent path: the buyer opens `/agents`, sets a cap for a second wallet, and approves MUSD for at least that amount. The agent wallet funds an agreement that already names the buyer.

## Security and limitations

- The resolver is chosen by the seller and shown before funding. On a disputed agreement, that address can pay either side in full. Choose it deliberately. The contract rejects a resolver that is the seller or the designated buyer.
- Buyers must release or dispute before the review deadline if they do not want finalizing to the seller.
- Evidence and dispute text are public. Do not put secrets, credentials, or personal data on-chain.
- A link in the delivery note can change or disappear. The hash covers only the text that was submitted.
- Direct transfers to the escrow are not credited and there is no rescue function.
- The app does not send a second state-changing transaction because a receipt timed out. Open the explorer link, then refresh.
- Dashboards read a bounded set of recent agreements. Activity is indexed from the first escrow deployment and shows the newest 200. A failed scan is an error with retry, not an empty history. Older agreements can still be opened by id.
- The install tree includes known advisories in Hardhat's transitive dependencies. Do not treat `npm audit` as a clean bill of health.
- Reentrancy is guarded and tested against a hostile token. The production asset is the configured MUSD contract, which was checked for code, symbol, and decimals.

## Troubleshooting

- **Unsupported network.** Switch to Mezo Testnet. Settings lists the chain ID, RPC, BTC gas token, and explorer.
- **Escrow actions disabled.** The escrow address is missing or the connected contract does not match the action. A missing address is intentional.
- **Agent budget button stays off.** The connected deployment has no `agentAllowance` function. Point the app at the current escrow.
- **Not enough MUSD.** The balance and shortfall come from the token contract. Borrow or swap on the Mezo testnet app.
- **Not enough gas.** Gas is BTC on Mezo, not ETH and not MUSD.
- **Agreement details could not be verified.** Funding stays disabled when the stored text does not match the on-chain hash.
- **Transaction submitted but not confirmed.** Open the explorer link. Do not immediately send a duplicate.
- **Local tests.** `npm run test:contracts` does not need a funded wallet or a testnet key.

## Two-minute demo

Keep the recording under 2 minutes and 15 seconds.

1. Open a checkout and show the Mezo trove health: collateral, debt, BTC price, collateral ratio, and liquidation price.
2. Fund the agreement, or borrow the shortfall from `BorrowerOperations` and then fund.
3. Show one seller payout and the 0.50% line. A refund stays whole.
4. Show the explorer page for the escrow at `0x069eef42fb0BaffFfFdCd7755e6e21E37299365d`. Source match: [Sourcify full match](https://repo.sourcify.dev/contracts/full_match/31611/0x069eef42fb0BaffFfFdCd7755e6e21E37299365d/).

On-chain receipts from 8 November 2026. Each row names the contract that actually received the transaction. Hashes are not moved onto a later escrow.

| Action | Contract | Transaction |
| --- | --- | --- |
| Borrow from the existing trove | Mezo `BorrowerOperations` `0xCdF7028c…bee5` | [`0x36df1c9ffd4e387173bdd670dbcc9ddcff0c475d84eb4772b524ecab7408cbf2`](https://explorer.test.mezo.org/tx/0x36df1c9ffd4e387173bdd670dbcc9ddcff0c475d84eb4772b524ecab7408cbf2) |
| Release to the seller | Historical escrow `0xE8814DC8…753F` | [`0x2782e288cf09e7e5b48663bab7aa1c3b35834a4174a5a257cb22b6e2a907d3d8`](https://explorer.test.mezo.org/tx/0x2782e288cf09e7e5b48663bab7aa1c3b35834a4174a5a257cb22b6e2a907d3d8) |
| Refund after a missed delivery | Historical escrow `0xE8814DC8…753F` | [`0xfcc626c8aaab137c793a231f0d349935fe750712d1bf5e6814d61c6934b5207c`](https://explorer.test.mezo.org/tx/0xfcc626c8aaab137c793a231f0d349935fe750712d1bf5e6814d61c6934b5207c) |
| Resolver split | Historical escrow `0xE8814DC8…753F` | [`0x634ff0bb6bb5d49618a0b875ad64ed2d33e5ccfe48afe87aff449d45872abeb6`](https://explorer.test.mezo.org/tx/0x634ff0bb6bb5d49618a0b875ad64ed2d33e5ccfe48afe87aff449d45872abeb6) |
| Stability Pool deposit | Mezo Stability Pool `0x1CCA7E41…680e` | [`0xdd484c92e4b307083e1d0da2895d1db0244ca9dfd074ec79ad3124453358cdb8`](https://explorer.test.mezo.org/tx/0xdd484c92e4b307083e1d0da2895d1db0244ca9dfd074ec79ad3124453358cdb8) |
| Stability Pool withdrawal | Mezo Stability Pool `0x1CCA7E41…680e` | [`0x3413d5a9f8af88726573888b29e8bfefd1ebb0304caa91a9cda76715c4d10443`](https://explorer.test.mezo.org/tx/0x3413d5a9f8af88726573888b29e8bfefd1ebb0304caa91a9cda76715c4d10443) |
| Mutual cancel | Historical escrow `0x50ab19e5…b793` | [`0x79d31e9051180978de25426be472dcd652116b82da5f752c48d952afedad8a8b`](https://explorer.test.mezo.org/tx/0x79d31e9051180978de25426be472dcd652116b82da5f752c48d952afedad8a8b) |
| Release to the seller, 0.02 MUSD fee on 4 MUSD, seller net 3.98 MUSD | Previous escrow `0x7b31489D…3fD4` | [`0xffac7be42e45fa4da98d62f3b8d2a7a67ffb40caffb6d98ddad4d8c161817f73`](https://explorer.test.mezo.org/tx/0xffac7be42e45fa4da98d62f3b8d2a7a67ffb40caffb6d98ddad4d8c161817f73) |
| Resolver split, 0.01 MUSD fee on the 2 MUSD seller leg | Previous escrow `0x7b31489D…3fD4` | [`0x1b1b90b6e525e42e5c2bb02e3a3a7723db97cc80a4a9f44fb912ec6eb1db8350`](https://explorer.test.mezo.org/tx/0x1b1b90b6e525e42e5c2bb02e3a3a7723db97cc80a4a9f44fb912ec6eb1db8350) |
| Refund of the full 4 MUSD after a missed delivery | Previous escrow `0x7b31489D…3fD4` | [`0xdfe8ab2cddb16c3efcec815ea39d3730c9fd8ac212b7f655b6cf785fee365f5a`](https://explorer.test.mezo.org/tx/0xdfe8ab2cddb16c3efcec815ea39d3730c9fd8ac212b7f655b6cf785fee365f5a) |
| Stability Pool withdrawal | Mezo Stability Pool `0x1CCA7E41…680e` | [`0x640c48adf92b94bb718eb6331e406283c67997ce8b4f8cffd0f30bb306ebab75`](https://explorer.test.mezo.org/tx/0x640c48adf92b94bb718eb6331e406283c67997ce8b4f8cffd0f30bb306ebab75) |
| Second milestone funded after release | Previous escrow `0x7b31489D…3fD4` | [`0x90ef98a3b49a4a1d56892692af21a5d38542f8b0deb0e42ade6485186a0dc6ba`](https://explorer.test.mezo.org/tx/0x90ef98a3b49a4a1d56892692af21a5d38542f8b0deb0e42ade6485186a0dc6ba) |
| Resolver fee paid from a dispute | Previous escrow `0x7b31489D…3fD4` | [`0x998c48d1c916b9eed979a6c4d10848d67427c4a5a50c058124c5709fffd6c31d`](https://explorer.test.mezo.org/tx/0x998c48d1c916b9eed979a6c4d10848d67427c4a5a50c058124c5709fffd6c31d) |

## Pitch deck

The pitch deck is the full-screen page at `/pitch`. Arrow keys, the on-screen buttons, or a click on either side of a slide move through it. The earlier PowerPoint remains at `/pitch/RELAY_Mezo_Buildathon_Pitch_Deck.pptx`. `/docs#pitch-deck` links to both.

## License

MIT.
