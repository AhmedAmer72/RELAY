# RELAY

**Secure the deal. Move the value.**

RELAY is a non-custodial protected checkout for MUSD on Mezo. A seller creates an agreement. A buyer deposits MUSD into an escrow contract. The contract — not the website — holds the funds until a delivery is accepted, a missed-delivery refund is claimed, the review window expires, or the named resolver settles a dispute.

Payments that follow the agreement.

This repository was specified as MEZO LOOP / LoopGuard and is implemented as RELAY. Mezo, MUSD, and other protocol names are unchanged.

## What is implemented

Wave 1 is the protected checkout:

- Wallet connection, Mezo Testnet detection, and an explicit network switch.
- Seller flow to create an agreement with amount, buyer, deadlines, review window, and resolver.
- Public checkout page that can be read before a wallet is connected.
- MUSD approval, when the allowance is short, and a separate funding transaction.
- Seller delivery evidence stored on-chain with a hash.
- Buyer release, missed-delivery refund, review-window finalization, and resolver settlement.
- Receipt, dashboard, activity, settings, and documentation pages.
- Status is shown from contract reads. A submitted transaction is not treated as confirmed.

Not in this version: mainnet transactions, protocol fees, private file storage, automatic arbitration, yield, a DeFi treasury, and an admin key that can move user funds. A treasury is not included until a real Mezo vault can be verified, including deposits and withdrawals.

## Architecture

```text
Browser UI (Next.js)
  -> wallet (injected EIP-1193)
  -> Mezo Testnet RPC
       -> RelayEscrow     holds MUSD and enforces the state machine
       -> MUSD ERC-20     the only escrow asset
  -> Blockscout explorer  verification links for transactions and addresses
```

The escrow contract is the source of truth for balances and status. Agreement text and delivery notes are stored on the contract and checked against keccak256 hashes. Event history is read from logs for a bounded block range. There is no database.

## State machine

```text
Created -> Funded -> Delivered -> Released
Created -> Cancelled
Funded -> Refunded
Delivered -> Disputed -> Released, Refunded, or Split
```

`Released`, `Refunded`, and `Cancelled` are terminal.

Deadline comparisons match the contract, the interface, and the tests:

| Action | When it is allowed |
| --- | --- |
| Fund | `Created` and timestamp `<=` funding deadline |
| Submit delivery | Seller, `Funded`, timestamp `<=` delivery deadline |
| Refund | Buyer, `Funded`, timestamp `>` delivery deadline |
| Buyer release or dispute | `Delivered` and timestamp `<=` review deadline |
| Finalize to seller | `Delivered` and timestamp `>` review deadline |

At the exact delivery deadline the seller can still submit evidence and the buyer cannot refund yet. At the exact review deadline the buyer can still release and either party can still dispute. One second later, only finalization to the seller remains, and only if nobody disputed. The caller of finalization receives nothing.

If a dispute is raised in time, unilateral release and refund stop. The resolver stored on that agreement can send the full amount to the seller or the buyer, or split it so the seller receives a stated amount and the buyer receives the rest. Neither side can receive the full amount through the split. RELAY does not decide who is right.

## Wave 2

These additions sit on the same escrow. They are not a second product.

- Milestone checkouts create a separate funded agreement for each stage, with its own amount and delivery deadline. The agreement metadata records the stage number.
- A public seller page lists agreements read from the contract, and each agreement has a receipt.
- `GET /api/x402/agreements/{id}` returns HTTP 402 with the MUSD amount and `fundEscrow` instructions while funding is open, and the on-chain receipt after that. It is not a direct MUSD transfer.
- A buyer can set an on-chain agent budget with `setAgentAllowance`. The agent can call `fundEscrowAsAgent` only for agreements that name that buyer, only up to the remaining budget, and only by pulling the buyer's existing MUSD approval. The agent does not become the buyer and cannot release, refund, or dispute. Set the budget to zero to revoke it. The current Mezo Testnet deployment includes this function. Older deployments do not, and the form stays off if it is pointed at one of them. The form is on Agents and Settings.

## Stack

- Node.js 20 or newer
- Next.js 15, React 19, TypeScript 5.9
- Tailwind CSS 4
- wagmi and viem
- Solidity 0.8.28, EVM `london`, optimizer 200 runs, `viaIR`
- Hardhat 2 and OpenZeppelin Contracts 5
- Vitest and Testing Library

`viaIR` is enabled because the creation function otherwise hits Solidity's stack limit. The bytecode target remains `london`, which is the EVM version in the official Mezo Hardhat example.

## Network configuration

Verified on 25 October 2026 against the live testnet RPC and the official docs:

- [Set up the developer environment](https://mezo.org/docs/developers/getting-started/configure-environment/)
- [Contracts and token addresses](https://mezo.org/docs/users/resources/contracts-reference/)
- [x402 quickstart, including how to get testnet MUSD](https://mezo.org/docs/developers/getting-started/musd-payments-x402/x402-quickstart/)

| | Mezo Testnet | Mezo Mainnet |
| --- | --- | --- |
| Chain ID | 31611 | 31612 |
| RPC | `https://rpc.test.mezo.org` | Not used by this app |
| Gas token | BTC, 18 decimals | BTC, 18 decimals |
| Explorer | `https://explorer.test.mezo.org` | `https://explorer.mezo.org` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |

On-chain reads of the testnet token returned name `Mezo USD`, symbol `MUSD`, and decimals `18`. Explorer routes were checked as Blockscout paths: `/tx/{hash}` and `/address/{address}`.

Mainnet is documented here so the addresses are not confused. The app does not add Mezo Mainnet and the deploy script refuses chain ID 31612.

Testnet MUSD is borrowed against testnet BTC. It is not dispensed by the faucet. The official quickstart says a borrow opens with a minimum debt of 2,000 MUSD (1,800 principal plus a 200 MUSD gas deposit). Re-check that page before a demo, because the minimum can change.

1. Request testnet BTC from [the faucet](https://faucet.test.mezo.org/) or the Mezo Discord `#testnet` channel.
2. Borrow MUSD at [mezo.org/feature/borrow](https://mezo.org/feature/borrow) while the wallet is on Mezo Testnet.

## Setup

```bash
npm install
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

`.env.example` already points at the current Mezo Testnet escrow. An invalid explicit address does not fall back to a placeholder. The same public values are the code defaults, so a host build still resolves the testnet contracts when those variables are unset.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CHAIN_ENV` | `testnet` (default) or `local` |
| `NEXT_PUBLIC_MEZO_TESTNET_RPC_URL` | Testnet RPC. Default is the official endpoint. |
| `NEXT_PUBLIC_MUSD_TESTNET_ADDRESS` | Testnet MUSD. Default is the verified address above. |
| `NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS` | Deployed `RelayEscrow`. Required for transactions. |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | Blockscout origin. Default is the testnet explorer. |
| `NEXT_PUBLIC_ESCROW_DEPLOY_BLOCK` | Optional. Lets activity search from the deployment block. |
| `NEXT_PUBLIC_LOCAL_RPC_URL` | Local Hardhat RPC when `CHAIN_ENV=local`. |
| `NEXT_PUBLIC_LOCAL_MUSD_ADDRESS` | Local mock token. Required in local mode. |
| `NEXT_PUBLIC_LOCAL_ESCROW_ADDRESS` | Local escrow. Required in local mode. |
| `MEZO_TESTNET_RPC_URL` | Deploy script RPC. Server-side only. |
| `MUSD_ADDRESS` | Deploy script token. Server-side only. |
| `DEPLOYER_PRIVATE_KEY` | Deploy script key. Never commit it and never prefix it with `NEXT_PUBLIC_`. |

## Host on Vercel

Import this repository in Vercel. The project is a Next.js app, and `vercel.json` sets the install command to `npm ci` and the build command to `npm run build`. Vercel serves the app itself, so no start command is required. Use Node 20, which `.node-version` and `package.json` both request.

Before the first production build, add every `NEXT_PUBLIC_` variable from `.env.example` in the Vercel project settings. Next.js inlines those values at build time. Changing them later requires a new deployment. Leave `DEPLOYER_PRIVATE_KEY` off Vercel. Contract deployment stays on a machine you control.

## Host on Render

`render.yaml` is a Render Blueprint for one Node web service named `relay`. In the Render dashboard, choose **New → Blueprint** and select this repository. Render runs `npm ci && npm run build`, then `npm start`. It sets `PORT`, and the blueprint sets `HOSTNAME` to `0.0.0.0` so the process accepts the platform proxy. The health check is `/`.

The blueprint also sets the public Mezo Testnet variables. Do not add `DEPLOYER_PRIVATE_KEY` to the Render service. That key is only for `npm run deploy:testnet`.

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
```

`npm run check` runs compile, contract tests, typecheck, lint, unit tests, and the production build.

`npm run test:e2e` runs the Hardhat lifecycle test named "full protected payment and an independent refund". It uses the real escrow contract on Hardhat's local chain. It does not pretend to be Mezo Testnet.

## Contracts

`contracts/RelayEscrow.sol` is the escrow. Tests live in `test/RelayEscrow.ts` and are loaded by `test/index.js` because Hardhat only auto-discovers TypeScript tests when the config file itself is TypeScript.

The tests cover creation validation, restricted and open funding, exact token amounts, fee-on-transfer rejection, delivery, buyer release, missed-delivery refund, review-window boundaries, dispute resolution, partial splits, agent budgets, cancellation, escrow isolation, reentrancy, and same-block conflicts.

### Deploy to Mezo Testnet

Use a dedicated testnet key. Do not deploy to mainnet with this script.

```bash
# .env.local or the shell environment
# DEPLOYER_PRIVATE_KEY=0x...
# MUSD_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
npm run deploy:testnet
```

The script checks chain ID 31611, refuses mainnet, and checks that the token symbol is `MUSD` and decimals are 18. It also requires `partialSettlementSupported` and a successful `agentAllowance` read before it records the deployment. A successful deploy writes `deployments/mezo-testnet.json` with the address, transaction hash, compiler settings, and explorer links. Copy the address into `NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS`. Keep `NEXT_PUBLIC_ESCROW_DEPLOY_BLOCK` at the earliest escrow block so older agreements stay in the activity index.

Contract verification on the explorer depends on Blockscout's current verification flow. The deployment record is the local source of the address and transaction.

## Demo flow

Use two wallets on Mezo Testnet after the contract is deployed.

1. Seller connects, switches to Mezo Testnet, and creates a checkout.
2. Wait until the receipt is confirmed and the app shows the agreement id. Copy `/checkout/{id}`.
3. Buyer opens that URL without connecting, reads the terms, resolver, and deadlines, then connects.
4. Buyer approves the exact MUSD amount if asked, then funds the escrow in a second transaction.
5. Confirm the funded state and the token balance change. The app re-reads the contract before it treats the action as matched.
6. Seller submits a short delivery note and an optional `https` link.
7. Buyer releases the funds. The seller receives the full escrow amount. There is no protocol fee.
8. For the refund path, create a second agreement, fund it, and do not deliver. After the delivery deadline, the buyer sends the refund transaction.

A dispute path: after delivery, either party can raise a dispute before the review deadline. The resolver wallet then settles the full amount to one side.

## Security and limitations

This software has not been independently audited. Passing these tests is not an audit.

- The resolver is a trusted address chosen by the seller and shown before funding. A resolver can send a disputed escrow entirely to one party. Choose that address deliberately. The contract rejects a resolver that is the seller or the designated buyer.
- Buyers must act before the review deadline if they do not want finalization to the seller.
- Evidence and dispute text are public. Do not put secrets, credentials, or personal data on-chain.
- A URL can change or disappear. The hash only proves the recorded text.
- Tokens sent directly to the contract are not credited to an agreement and cannot be recovered. There is no rescue or admin withdrawal function.
- The app will not send a second state-changing transaction just because a receipt timed out. Use the explorer link, then refresh.
- Activity and dashboards read a bounded set of recent agreements and logs. Older items can be opened by agreement id. Empty results after a failed read are shown as errors, not as an empty account.
- Dependency install reported known vulnerabilities in the toolchain, including Hardhat's older transitive packages. Do not treat `npm audit` as clean.
- Reentrancy is guarded and tested against a hostile token. The production token is the configured MUSD contract, which was checked for code, symbol, and decimals, not fully audited here.

## Troubleshooting

- **Unsupported network.** Switch to Mezo Testnet. The settings page lists the chain ID, RPC, BTC gas token, and explorer for manual wallet setup.
- **Escrow actions disabled.** Set the deployed escrow address. A missing address is intentional.
- **Not enough MUSD.** The balance and shortfall are shown from the token contract. Borrow testnet MUSD with the official flow above.
- **Not enough gas.** Gas is BTC on Mezo, not ETH and not MUSD.
- **Agreement details could not be verified.** Funding stays disabled when the stored text does not match the on-chain hash.
- **Transaction submitted but not confirmed.** Open the explorer link. Do not immediately send a duplicate.
- **Local tests.** `npm run test:contracts` does not need a funded wallet or a testnet key.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Product introduction |
| `/create` | Seller wizard |
| `/checkout/[id]` | Public agreement and actions |
| `/escrows/[id]` | Agreement detail and history |
| `/receipt/[id]` | Receipt JSON |
| `/dashboard` | Agreements for the connected wallet |
| `/activity` | Contract events |
| `/how-it-works` | Rules and FAQ |
| `/docs` | State machine and limitations |
| `/settings` | Wallet, network, and contract addresses |
