# RELAY

**Secure the deal. Move the value.**

RELAY is a non-custodial checkout for MUSD on Mezo. A seller publishes an agreement. A buyer, or an agent the buyer has capped, deposits the exact MUSD amount into `RelayEscrow`. The contract holds the tokens until the buyer releases them, a missed delivery is refunded, the review window finalizes payment to the seller, or the named resolver settles a dispute in full or as a split.

The website prepares transactions and reads the chain. It does not custody funds, and it has no key that can withdraw them.

This repository was specified as MEZO LOOP / LoopGuard and is shipped as RELAY. Mezo and MUSD keep their protocol names.

## Status

| | |
| --- | --- |
| Network | Mezo Testnet, chain ID 31611 |
| Current escrow | [`0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46`](https://explorer.test.mezo.org/address/0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46) |
| Deployment block | 16369215 |
| Asset | MUSD, 18 decimals, Mezo Testnet only |
| Mainnet | Disabled. The deploy script refuses chain ID 31612. |
| Audit | This software has not been independently audited. Tests are not an audit. |
| Protocol fee | None. The wallet shows the BTC network fee. |

New checkouts are created on the current escrow. That deployment supports split settlement and agent budgets. Earlier deployments stay readable so existing agreements are not dropped. They do not gain functions that were not in their bytecode.

| Contract | Block | What it can do |
| --- | --- | --- |
| `0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46` | 16369215 | Current. Split settlement and agent budgets. |
| `0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087` | 16365683 | Split settlement. No agent budgets. |
| `0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125` | 16358867 | Original checkout. No split and no agent budgets. |

Agreement ids are per contract. Opening an older agreement uses the contract address as well as the id, so id 1 on the original escrow is not confused with a later id 1.

## What a user can do

A buyer can read the seller, amount, deadlines, review window, and resolver before connecting a wallet.

- **Create.** One payment, or a milestone plan of two to five stages. Each stage is its own agreement, with its own amount and delivery deadline. Funding one stage does not fund the others.
- **Buyer.** Name a wallet, or leave the link open. The first allowed funder of an open link becomes the buyer. The seller and the resolver cannot fund an open agreement.
- **Fund.** Approve MUSD when the allowance is short, then deposit the exact amount. The contract rejects a token that delivers a different balance.
- **Deliver.** The seller submits a note of up to 800 bytes and an optional link. The contract stores the text and a keccak256 hash of it. The hash does not prove the work is acceptable.
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
Funded    -> Delivered   seller
Funded    -> Refunded    buyer, after the delivery deadline, with no delivery
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
| Submit delivery | Seller | `Funded`, timestamp `<=` delivery deadline |
| Refund | Buyer | `Funded`, timestamp `>` delivery deadline, no delivery |
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
| `/agents` | Set or revoke an agent spending cap |
| `/activity` | Contract events from the current and earlier escrows |
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

Checked on 25 October 2026 against the live testnet RPC and the official docs:

- [Developer environment](https://mezo.org/docs/developers/getting-started/configure-environment/)
- [Contracts and token addresses](https://mezo.org/docs/users/resources/contracts-reference/)
- [MUSD and x402 quickstart](https://mezo.org/docs/developers/getting-started/musd-payments-x402/x402-quickstart/)

| | Mezo Testnet | Mezo Mainnet |
| --- | --- | --- |
| Chain ID | 31611 | 31612 |
| RPC | `https://rpc.test.mezo.org` | Not used by this app |
| Gas token | BTC, 18 decimals | BTC, 18 decimals |
| Explorer | `https://explorer.test.mezo.org` | `https://explorer.mezo.org` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |

On-chain reads of the testnet token returned name `Mezo USD`, symbol `MUSD`, and decimals `18`. Explorer links use Blockscout paths `/tx/{hash}` and `/address/{address}`.

Mainnet addresses are listed so they are not pasted into the testnet app by mistake. This app does not add Mezo Mainnet.

Testnet MUSD is borrowed against testnet BTC, or swapped from testnet BTC in the [Mezo testnet app](https://testnet.mezo.org). It is not dispensed by the faucet. The faucet dispenses testnet BTC. The official quickstart has described a minimum borrow; re-check that page before a demo, because the minimum can change.

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

Import this repository. `vercel.json` sets the install command to `npm ci` and the build command to `npm run build`. Use Node 20. Vercel serves the app, so no start command is required.

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
7. The buyer releases the funds. The seller receives the full amount.
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
- Activity and dashboards read a bounded set of recent agreements and logs. Older items can be opened by agreement id. A failed read is shown as an error, not as an empty account.
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

## Pitch deck

The Mezo Buildathon deck is `RELAY_Mezo_Buildathon_Pitch_Deck.pptx` at the repository root, and it is served at `/pitch/RELAY_Mezo_Buildathon_Pitch_Deck.pptx`. The landing page and `/docs#pitch-deck` link to it.

## License

MIT.
