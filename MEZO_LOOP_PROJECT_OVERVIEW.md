> **Implemented product name: RELAY.** This document was originally titled for MEZO LOOP and the LoopGuard module. The application built from it is **RELAY**. Primary tagline: **Secure the deal. Move the value.** Supporting message: **Payments that follow the agreement.** Where the text below says MEZO LOOP or LoopGuard, read the product as RELAY. Do not rename the Mezo network, MUSD, or third-party protocol identifiers.

# MEZO LOOP — Complete Product, UX, Architecture & Build Specification

> **Purpose:** This document is the single source of truth for Cursor + Grok 4.7 to design and build the MEZO LOOP project. Read the full document before planning or editing code. Inspect the existing repository and preserve any working architecture unless there is a strong, documented reason to change it.
>
> **Product wedge:** `LoopGuard` — protected MUSD checkout using an on-chain escrow agreement.
>
> **Main tagline:** **Payments that follow the deal.**
>
> **Buildathon context:** Mezo Buildathon, Track 2 (Access & Distribution) as the primary track, with a deliberate path toward Track 1 (DeFi). Wave 1 must demonstrate a real, end-to-end flow on Mezo Testnet. Wave 2 can add more advanced payment, agent, and treasury functionality.

---

## 0. Instructions for Cursor / Grok 4.7

Act as a **principal product designer, senior Web3 product engineer, Solidity security-minded architect, and QA lead**.

### Required working method

1. **Audit before changing anything.** Inspect the repository, current framework, scripts, routing, styling system, wallet integration, contracts, deployed addresses, environment variables, and existing tests. Do not assume this is a blank project.
2. **Create a short repo audit** with: current stack, current working functionality, broken/incomplete areas, existing reusable components, and mismatches against this specification.
3. **Create an implementation plan** with milestones, impacted files, dependencies, risks, and acceptance criteria. Then implement in small, verifiable steps rather than rewriting everything at once.
4. **Use real behavior, not decorative mock functionality.** Do not show a successful transaction, a funded escrow, an index/chart/metric, a wallet balance, or an explorer URL unless it is backed by live chain data or clearly marked as demo data in a deliberate demo mode.
5. **Do not silently invent** contract addresses, ABI methods, RPC endpoints, integrations, yield products, API credentials, event data, deployed contracts, or audit status. Verify the referenced Mezo docs, and isolate configurable values.
6. **Do not deploy to mainnet, use real user funds, request secret keys, or sign transactions on behalf of users.** Use Mezo Testnet for development and demos. Never ask the user to paste a private key or seed phrase into the application or chat.
7. **Keep Wave 1 scope small.** Finish the complete escrow checkout flow before attempting AI-agent autonomy, cross-chain features, yield strategies, or complex dispute markets.
8. **Prefer secure and understandable over flashy.** The product should feel like a mature fintech/Web3 tool: clear payment state, clear risks, clear next action, strong transaction previews, and no confusing crypto jargon unless explained.
9. **If the repository differs from the proposed stack below, adapt to the actual repository.** Do not migrate frameworks simply because this document lists a preferred option.
10. After changes, run the available lint, type-check, unit tests, contract tests, and production build. Report exactly what passed, failed, or remains blocked.

### Mandatory implementation rules

- No private key or seed phrase collection, even for a demo.
- No arbitrary token support in the MVP. The escrow contract should be deployed with the verified MUSD token address for the target network.
- No owner/admin withdrawal function that can drain user escrow balances.
- No fake “AI verified delivery” claims. Delivery evidence is a claim submitted by a party; an on-chain hash proves integrity of the referenced evidence, not that the work is good or correct.
- No claim that escrow eliminates fraud, guarantees delivery, guarantees refunds in every situation, or has been audited unless that is demonstrably true.
- No automatic yield or treasury investment in Wave 1.
- No dependency on an unverified third-party arbitration, facilitator, indexing, or vault service without an explicit configuration and failure state.
- Keep a strict separation between UI state and canonical on-chain state.

---

## 1. Executive Summary

### 1.1 What is MEZO LOOP?

MEZO LOOP is a Mezo-native payment coordination product designed to make MUSD useful in real commercial transactions. Its first product module is **LoopGuard**, a protected checkout workflow for paying for services or digital deliverables using MUSD.

A seller creates a payment agreement. The agreement states the amount, buyer, seller, funding deadline, delivery deadline, review window, terms reference, and designated dispute resolver. The buyer can inspect the conditions and deposit MUSD into a smart contract. The contract holds the funds until a permitted outcome occurs: release to the seller, refund to the buyer, or a transparent dispute resolution.

The central differentiator is not another payment link. It is a **payment that follows explicit, inspectable deal terms**.

### 1.2 One-sentence pitch

**MEZO LOOP lets buyers and sellers create MUSD payments with on-chain delivery deadlines, review windows, and transparent release/refund rules—so online transactions can be safer and easier to verify.**

### 1.3 Product promise

- Buyers can see the payment terms before funding.
- Sellers can demonstrate that a buyer funded a specific agreement.
- MUSD remains in the escrow contract until a permitted outcome occurs.
- Each important state change can be independently checked on the Mezo explorer.
- A shared invoice link can take a buyer directly to one clear action.

### 1.4 What MEZO LOOP is not in Wave 1

- Not a general-purpose wallet.
- Not a replacement for Mezo's native MUSD payments or x402.
- Not a guarantee that a seller will deliver quality work.
- Not a decentralized arbitration network yet.
- Not a yield aggregator or automated vault allocator yet.
- Not a cross-chain bridge.
- Not an AI agent with unrestricted access to user funds.

### 1.5 Why this can matter to Mezo

MEZO LOOP is intended to increase practical MUSD usage by supporting commerce between freelancers, clients, digital-service providers, small teams, and eventually software/AI agents. It is composable: the escrow contract can be called by the web app and later integrated into other applications. The escrow module creates a concrete use case distinct from simple transfers and pay-per-request payments.

The product must still prove the need with user feedback. Do not claim market adoption, volume, or competitor superiority without evidence.

---

## 2. Buildathon Fit and Scope

### Primary track: Track 2 — Access & Distribution

The MVP lowers friction for users who need to make or receive MUSD payments. The main proof is a real, successful escrowed payment on Mezo Testnet.

### Secondary track path: Track 1 — DeFi

A later treasury extension may let merchants keep a defined liquid reserve and optionally place only eligible excess MUSD into a verified Mezo DeFi strategy. This is **not part of the Wave 1 product**. Before implementation, verify a real, programmable vault/pool integration, its contract address, deposit/withdraw ABI, liquidity constraints, fees, and withdrawal timing. Never pretend that a UI link to a vault is a meaningful integration.

### Suggested wave scope

#### Wave 1 — A focused, working protected checkout

Must demonstrate:

1. Connect wallet and identify Mezo Testnet.
2. Seller creates a protected checkout agreement.
3. Buyer opens a shareable checkout page and sees the terms.
4. Buyer approves MUSD if needed and funds the escrow.
5. Seller submits delivery evidence.
6. Buyer releases funds, or a valid timeout/refund route is exercised.
7. Both sides can see status, transaction hashes, and explorer links.
8. Contract tests cover allowed and forbidden transitions.

#### Wave 2 — Differentiation and deeper utility

Potential additions, in order of value:

1. A carefully defined dispute-resolution flow with partial settlement.
2. Multiple milestones / staged payment, each with its own delivery and acceptance conditions.
3. Public seller profile, completed transaction history, and shareable receipts.
4. x402 compatibility for developers who want machine-readable, HTTP-native payment requirements, if the integration is technically appropriate.
5. Agent spending policies that call approved checkout endpoints within strict budgets, with on-chain or contract-enforced limits where feasible.
6. Treasury integration only after the vault/pool is verified and real withdrawals are tested.

Only resubmit Wave 2 with real, material technical progress and a clear changelog.

---

## 3. Target Users and Jobs to Be Done

### Persona A — Freelancer / digital-service seller

**Needs:** Create a clear invoice, know the client funded it, share a link, submit delivery evidence, and receive payment without arguing about what was agreed.

**Pain points:** Clients disappear after delivery; payment terms are scattered across chats; payment receipts do not prove delivery terms.

**Success:** A client funds a protected checkout, both sides can inspect the agreement, and the seller receives MUSD when release conditions are met.

### Persona B — Client / buyer

**Needs:** Understand what they are paying for, know what happens if delivery is late, and inspect the seller's evidence before releasing the funds.

**Pain points:** Paying an unknown seller upfront; vague refund terms; not knowing where the funds are held.

**Success:** The buyer can review the deal and on-chain contract details before funding and can use the defined review/refund/dispute path.

### Persona C — Small team / DAO operator (later)

**Needs:** Milestone-based payments and a verifiable audit trail.

**Not in Wave 1:** Multi-approver roles, team treasury governance, and complex budget policies.

### Persona D — Developer / AI-agent service provider (later)

**Needs:** Machine-readable payment agreements, paid service access, and bounded spending permissions.

**Not in Wave 1:** Autonomous agent custody or unrestricted automated payments.

---

## 4. Core Product Rules

1. **MUSD is the only supported escrow asset in the MVP.** Do not offer a token selector.
2. The buyer must see the exact amount, seller, terms, delivery deadline, review window, and designated resolver before funding.
3. The UI must distinguish on-chain facts from off-chain descriptions and user-submitted evidence.
4. The escrow contract is the source of truth for funds and status.
5. The explorer is a verification surface, not the app's source of truth.
6. All time limits must be shown with the user's local date/time plus an explicit timezone or relative-time helper.
7. No success state until the transaction has a receipt and the expected contract state is confirmed.
8. The app should not display an estimated completion as a confirmed event.
9. The app must clearly disclose the arbitration trust assumption before the buyer funds.
10. Wave 1 should use zero protocol fee unless there is a documented reason to add one. Do not invent a fee or show a revenue metric.

---

## 5. Brand and Visual Direction

### Brand identity

- **Product name:** MEZO LOOP
- **Core module:** LoopGuard
- **Tagline:** Payments that follow the deal.
- **Tone:** Calm, precise, protective, professional, technically credible.
- **Personality:** Fintech reliability with Web3 transparency; not meme-coin culture.

### Visual keywords

Trust, protected value, checkpoints, verified conditions, clear state transitions, precision, calm confidence.

### Visuals to avoid

- Generic neon crypto dashboards full of token icons.
- Excessive purple gradients, glowing coins, floating Bitcoin artwork, or casino-style charts.
- A chatbot-first interface. AI is not the core Wave 1 feature.
- Huge empty hero sections that push the primary action below the fold.
- Overuse of glassmorphism and blur behind important text.
- Fake activity feeds, invented volume numbers, and decorative charts that imply real data.

### Suggested color tokens

Implement as CSS variables/design tokens; confirm against any existing repository theme before replacing it.

```css
:root {
  --background: #08111F;      /* deep blue-black */
  --surface: #0D1A2B;         /* primary card */
  --surface-raised: #13243A;  /* elevated panels */
  --border: #24354B;          /* restrained separators */
  --text-primary: #F4F7FB;
  --text-secondary: #A8B6C8;
  --text-muted: #718198;
  --brand: #54D6A0;            /* mint/emerald */
  --brand-hover: #76E5B7;
  --brand-contrast: #061A13;
  --info: #72B7FF;
  --warning: #FFC86B;
  --danger: #FF7D87;
  --success: #54D6A0;
  --focus: #9FE8CA;
}
```

Use semantic colors consistently. Do not communicate state by color alone; always include a label and/or icon.

### Typography

- Use the repo's existing, readable sans-serif if appropriate; otherwise use Inter or Geist Sans.
- Clear hierarchy: compact page title, readable section headers, restrained metadata.
- Use tabular numerals for amounts, IDs, timestamps, and balances.
- Avoid tiny text for critical terms and safety disclosures.

### Layout and motion

- Desktop: compact sidebar or top navigation plus a focused main content column.
- Checkout view: one main column with a clear agreement summary; avoid dashboard clutter.
- Mobile: single-column, full-width action buttons, sticky primary action only if it does not hide details.
- Motion should communicate state transitions, confirmations, or loading—not decoration. Respect reduced-motion settings.

---

## 6. Information Architecture and Routes

Keep URLs stable and shareable. Example routes below can be adapted to the repository router.

### Public routes

- `/` — Landing / product overview.
- `/checkout/[escrowId]` — Public checkout agreement and payment flow.
- `/receipt/[escrowId]` — Public-safe receipt and status summary.
- `/how-it-works` — Explain the workflow and dispute assumptions.
- `/docs` — Technical/product documentation and supported-network information.

### Wallet-gated routes

- `/app` or `/dashboard` — Overview of the connected user's escrows.
- `/create` — Create a protected checkout.
- `/escrows/[escrowId]` — Escrow details and actions available to the connected role.
- `/activity` — Transaction activity derived from verified chain logs.
- `/settings` — Network, wallet, display preferences, and safety information.

### Global navigation

Desktop:
- Logo/brand at the top.
- Dashboard
- Create checkout
- Activity
- Docs / How it works
- Network status and wallet control

Mobile:
- Compact header with brand and wallet.
- Dashboard / Create / Activity navigation using a bottom nav or compact menu.
- The checkout route should prioritize the agreement and its current action, not app navigation.

### Route access behavior

- Public checkout and receipt pages must load without a wallet connection.
- A user must connect a wallet only when they take an on-chain action.
- If the wallet is connected to the wrong chain, show a clear network-switch action; do not silently sign a transaction on another chain.
- If the wallet cannot switch networks, explain how to add Mezo Testnet manually.
- If RPC or wallet connection fails, display a useful retry/error state and preserve non-sensitive form input.

---

## 7. Detailed Page Specifications

## 7.1 Landing page `/`

### Goal
Explain the product in seconds and lead the user into a real checkout or the connected dashboard.

### Hero content

Eyebrow: `PROTECTED PAYMENTS ON MEZO`

Headline: `Payments that follow the deal.`

Supporting copy: `Create MUSD checkouts with clear delivery terms, review windows, and transparent on-chain outcomes.`

Primary CTA: `Create protected checkout`

Secondary CTA: `See how it works`

Network badge: `Mezo Testnet` in the development build. Do not label it mainnet unless configured and verified.

### Hero layout

- Left: heading, short description, two actions, three short trust facts.
- Right: compact product preview of a checkout agreement card showing a sample flow **explicitly marked as a product preview**. Do not portray the preview as a real transaction.
- Use a restrained diagram: `Agree → Fund → Deliver → Release`.

### Content sections

1. **How LoopGuard works** — four steps with small icons and concise descriptions.
2. **Built for both sides** — buyer and seller cards with their respective protections and obligations.
3. **On-chain transparency** — explain what is verifiable and what is not.
4. **Safety and dispute note** — explain that the resolver is identified in the terms and that escrow does not guarantee work quality or eliminate risk.
5. **Footer** — Docs, GitHub, Mezo docs, explorer, Terms, Privacy placeholder only if implemented. Do not link to nonexistent pages.

### Landing states

- Wallet disconnected: show `Connect wallet` and `Create checkout` (the latter can route to create page, then prompt wallet connection).
- Wallet connected: show `Open dashboard` plus `Create checkout`.
- Unsupported chain: show a warning strip with a switch-network action.

## 7.2 Dashboard `/dashboard`

### Goal
Help a connected user quickly answer: what needs my attention, where are my funds, and what happened recently?

### Header
- `Good [time-of-day]` is optional; never invent a user's name.
- Page title: `Your checkouts`.
- Short helper: `Track protected MUSD payments from funding through settlement.`
- Primary button: `Create checkout`.

### Summary cards
Use only values computed from real escrows/events belonging to the wallet:
- `Awaiting action`
- `Funds in escrow`
- `Completed`
- `Disputed`

If data cannot be indexed yet, show `—` plus an explanatory state; do not use example numbers as if real. On a first-time wallet, show an empty state rather than zeros that imply indexing completed if it has not.

### Escrow list/table
Columns on desktop:
- Agreement / invoice title
- Role (`Buyer` / `Seller`)
- Counterparty (shortened address + copy action)
- Amount (`MUSD`)
- State badge
- Updated / deadline
- `Open` action

Filters:
- All
- Needs my action
- As buyer
- As seller
- Completed
- Disputed

Mobile: cards, with amount and status prominently displayed. Avoid a horizontally scrolling dense table.

### Empty state
Title: `Your first protected checkout starts here.`
Copy: `Create an agreement or open a checkout link someone shared with you.`
Actions: `Create checkout`, `How it works`.

### Loading / error / stale data states
- Skeleton rows only while fetching.
- If RPC/indexer fails, show a retry action and the last-updated time if known.
- Never silently treat a failed fetch as an empty account.

## 7.3 Create checkout `/create`

### Goal
Allow a seller to define a clear, immutable agreement that the buyer can inspect before funding.

### Wizard structure
Use a 3-step wizard with an always-visible step indicator:
1. `Payment details`
2. `Delivery & review`
3. `Review & create`

Do not make this a long, cluttered form. Provide concise help text and inline validation.

### Step 1 — Payment details
Fields:
- `Title` — required; 3–80 chars.
- `What are you delivering?` — required, short description; maximum length chosen by implementation and documented.
- `Amount` — required, positive MUSD amount, parse precisely using 18 token decimals; never use floating-point math for on-chain amounts.
- `Buyer wallet` — optional mode choice:
  - `Specific buyer` (enter and validate an EVM address); or
  - `Anyone with this link` (first valid funder becomes the buyer).
- `Terms` — required plain language; describe deliverable and acceptance condition. Show a character count and preview.

Default: `Specific buyer` mode only if user inputs a valid address. Do not silently assign the connected seller as the buyer.

### Step 2 — Delivery & review
Fields:
- `Funding deadline` — latest time the buyer can fund the checkout. Default to 24 hours after creation; it must be before the delivery deadline.
- `Delivery deadline` — the seller’s deadline, and must be later than the funding deadline by a meaningful minimum interval.
- `Review window` — select a conservative set of supported durations, e.g. 24h, 48h, 72h, or a custom supported value. Validate bounds in both UI and contract.
- `Dispute resolver` — required address in the MVP if dispute handling is enabled. Show a plain-language disclosure that this address can resolve disputed funds according to contract rules. Never hide who the resolver is.
- Helper text explains: if delivery is not marked by the deadline, the buyer may be able to reclaim funds under the contract; if the buyer does not act during the review window, the documented default rule applies.

The exact timeout policy must match the Solidity implementation. UI copy must never promise an outcome the contract does not enforce. For this specification, the review-window default is fixed: if there is no buyer release or dispute before the review deadline, the contract permits finalization to the seller. The UI must clearly disclose this before funding.

### Step 3 — Review & create
Display an immutable-looking summary card:
- Title and description
- Amount in MUSD
- Buyer mode/address
- Seller address (connected wallet)
- Funding deadline with local timezone
- Delivery deadline with local timezone
- Review window
- Resolver address
- Terms
- Network and escrow contract address (after deployment)
- `No protocol fee in this version` only if the contract indeed charges no fee

Require a checkbox: `I have reviewed the details and understand the dispute resolver shown above.`

CTA: `Create protected checkout`

### Creation transaction states
1. `Preparing` — local validation and chain/address checks.
2. `Wallet confirmation` — wallet request opened.
3. `Submitted` — show shortened transaction hash and explorer link.
4. `Confirming` — wait for receipt; if practical, wait for contract state/event confirmation.
5. `Created` — show checkout URL and copy/share controls.
6. `Rejected` — wallet rejection with safe retry.
7. `Failed` — display useful reason when available; don't imply an escrow was created.

The app must not show the shareable URL as confirmed before the creation transaction succeeds. If a transaction is submitted but its receipt is unknown, show `Transaction submitted; confirmation pending`, not `Created`.

## 7.4 Public checkout `/checkout/[escrowId]`

### Goal
The highest-quality screen in the product. It must reduce uncertainty for a buyer who may not know the seller.

### Above the fold
- Brand mark and `Protected MUSD checkout` label.
- Agreement title.
- Amount, using tabular numbers: `50.00 MUSD` (format actual amount, do not hardcode example data in production).
- Seller address with copy and explorer links.
- Status pill.
- A compact progress rail: `Created → Funded → Delivered → Settled`.
- One clearly dominant next action based on the on-chain state and connected user's role.

### Agreement details panel
- Description and terms.
- Buyer eligibility mode and buyer address (if restricted).
- Funding deadline.
- Delivery deadline.
- Review window.
- Dispute resolver with explicit disclosure.
- Network and contract addresses.
- `View agreement on explorer` / `View contract` links once verified.
- Terms integrity indicator: `Metadata hash matches` only if the metadata hash is actually recomputed and verified.

### Funding behavior
If not connected:
- CTA: `Connect wallet to fund`.
- Explain the buyer can inspect all terms before connecting.

If connected wallet is wrong chain:
- CTA: `Switch to Mezo Testnet` (or configured network name).
- After switching, re-read balance and state.

If connected wallet is not eligible buyer:
- Show `This checkout is restricted to another buyer` and the designated address.
- Do not show an enabled Fund button.

If eligible but MUSD balance is too low:
- Show actual MUSD balance and shortfall.
- Provide official Mezo testnet docs/faucet links as appropriate; explain MUSD is not necessarily dispensed from the faucet. The official quickstart describes obtaining testnet BTC and borrowing MUSD against it.
- Do not make the UI request a private key.

If allowance is insufficient:
1. Show `Approve MUSD` with exact required amount by default.
2. Wait for the approval receipt.
3. Re-read allowance.
4. Enable `Fund escrow` only when allowance is sufficient.
5. Make clear that approval is separate from funding.

If allowance is already sufficient:
- Skip approval and show `Fund escrow`.

Funding confirmation modal/panel must show:
- Exact MUSD amount.
- Seller address.
- Escrow contract address.
- Deadline / review terms.
- Any visible wallet network fee estimate if available. Never fabricate an exact gas fee.
- A statement that funding locks the amount under the displayed contract rules.

### After funding
- The contract state, not optimistic UI, determines the new status.
- Show `Funds are held by the escrow contract` with explorer link and transaction hash.
- Only seller actions can submit delivery evidence, and only buyer actions can accept/release or raise the actions permitted by contract.

## 7.5 Escrow detail `/escrows/[escrowId]`

### Layout
- Header: title, amount, state, copy URL.
- Left/main: timeline and current required action.
- Right/sidebar on desktop: agreement facts, parties, terms hash, resolver, chain/explorer links.
- Mobile: stack sections in order of importance.

### Timeline events
Show real contract events with timestamps/block numbers where available:
- AgreementCreated
- EscrowFunded
- DeliverySubmitted
- DisputeRaised
- EscrowReleased
- EscrowRefunded
- DisputeResolved

Do not fabricate missing historical events. If using an indexer that is behind, show a freshness indicator.

### Seller actions
Depending on state:
- `Submit delivery evidence`
- `Cancel unfunded checkout` (only when permitted)
- View outcome / transaction

### Buyer actions
Depending on state:
- `Fund escrow`
- `Approve delivery & release funds`
- `Raise a dispute`
- `Refund after missed delivery deadline` (only if the contract permits it)

### Shared actions
- Copy checkout link.
- Copy transaction hash.
- Open explorer.
- Download/copy receipt details.

## 7.6 Delivery evidence flow

When seller submits work:
- Form fields: evidence link or concise note; optional file must be stored in a trusted configured service, not merely in client memory.
- Explain that a URL can change unless content is pinned/hashed.
- Compute a cryptographic hash of a canonical evidence metadata object; store the hash on-chain. Keep sensitive private client files off-chain.
- Do not upload user content to a third party without clear disclosure.
- Show confirmation: `Evidence submitted on-chain` only after a successful transaction receipt and confirmed state.
- The hash proves matching bytes/metadata, not that the work meets the terms.

Wave 1 may support a text/link-only evidence note to avoid unneeded file storage complexity. If no backend/pinning system exists, don't pretend uploaded data is permanently stored.

## 7.7 Receipt `/receipt/[escrowId]`

Show:
- Outcome (released, refunded, or disputed/pending).
- Agreement ID.
- Amount and token.
- Buyer and seller shortened addresses.
- Creation/funding/release/refund transaction hashes when available.
- Delivery evidence hash (not private content).
- Terms/metadata hash.
- Block explorer links.
- Network name.

Add `Copy receipt` as text/JSON. This must be generated from actual data. A receipt is a record, not an endorsement of service quality.

## 7.8 Activity `/activity`

- Event-driven list, no fabricated chart.
- Filters: all, funded, delivered, released, refunded, disputed.
- Date range only if indexing supports it.
- Copyable hashes and explorer links.
- Pagination or capped results to avoid trying to load the chain's entire history in the browser.

## 7.9 How it works `/how-it-works`

Explain the flow in simple language:
1. Agree on a deal.
2. Buyer checks the terms and funds the escrow.
3. Seller submits delivery evidence.
4. Buyer reviews and releases, or a contract-defined timeout/dispute rule applies.

Include a clear FAQ:
- Who controls funds while in escrow?
- Can the seller withdraw early? (No, unless the contract explicitly permits it; MVP should not.)
- What happens if no one responds?
- Who is the dispute resolver?
- Does the app guarantee delivery or refunds? (No.)
- What is MUSD and which network is this app using?
- What fees exist? State only verified fees.

---

## 8. Required User Journeys

### Journey A — Seller creates a checkout

1. Seller opens app and connects wallet.
2. App confirms expected chain and reads MUSD/contract configuration.
3. Seller opens Create checkout.
4. Completes payment details.
5. Sets delivery deadline and review window.
6. Selects/enters the dispute resolver; sees explicit disclosure.
7. Reviews a clear summary.
8. Confirms the contract transaction in their wallet.
9. Waits for receipt and the expected event/state.
10. Receives a shareable checkout URL and can copy it.

**Failure paths:** invalid address, zero/too-small amount, invalid deadline, no resolver when required, wrong chain, user rejects signature, RPC error, revert, transaction pending, receipt timeout, or created state cannot be read after a receipt.

### Journey B — Buyer funds a checkout

1. Buyer opens a shared URL without needing a wallet first.
2. Reads amount, seller, deadlines, terms, and resolver.
3. Connects wallet only when ready to fund.
4. App checks chain, buyer eligibility, MUSD balance, token address, and allowance.
5. Buyer approves exact amount if needed.
6. Buyer confirms funding transaction.
7. App waits for receipt and reloads escrow state.
8. Checkout shows actual funded state and transaction link.

**Failure paths:** wrong chain, invalid or expired invoice, buyer mismatch, low balance, approval rejected, funding rejected, amount mismatch, duplicate click, transaction already funded by another wallet, or RPC/indexer disagreement.

### Journey C — Seller submits delivery

1. Seller opens funded escrow.
2. App verifies connected wallet is the seller.
3. Seller adds delivery link/note.
4. App computes evidence hash and previews the content/hash.
5. Seller confirms transaction.
6. On confirmed chain state, timeline shows `Delivery submitted` and the review deadline.

### Journey D — Buyer accepts and releases

1. Buyer sees submitted evidence and review deadline.
2. Buyer chooses `Approve & release`.
3. Confirmation panel clearly says the release sends the escrowed MUSD to the seller and may be irreversible.
4. Buyer confirms in wallet.
5. App waits for receipt and checks the state is `Released`.
6. Receipt view updates with event and transaction hash.

### Journey E — Missed delivery deadline

1. When the deadline passes and no delivery is recorded, the app re-reads on-chain state and timestamp.
2. If the contract's rules allow buyer refund, the buyer sees the eligibility explanation and CTA.
3. Buyer confirms refund transaction.
4. App confirms receipt and `Refunded` state.

### Journey F — Dispute

1. Eligible party chooses `Raise dispute` before the contract-defined cutoff.
2. They submit a reason and optional evidence hash; no private information should be put on-chain.
3. Contract changes state to `Disputed` and blocks unilateral release/refund functions.
4. App shows the resolver address, dispute status, and exact allowed next step.
5. The designated resolver makes the outcome transaction according to the contract.
6. Both parties see the on-chain outcome and receipt.

Never create a `Disputed` UI state unless the contract has a valid settlement path. Never promise support staff will handle a dispute if no such process exists.

---

## 9. Escrow Smart Contract Specification

> This is a design requirement, not audited Solidity. Treat it as a starting architecture. Implement comprehensive tests and seek expert review before any real-fund mainnet use.

### 9.1 Network/token configuration

- Constructor takes the verified MUSD token address and stores it as `immutable`.
- Use an audited, maintained `SafeERC20` library compatible with the existing repo/dependencies if available. Do not vendor arbitrary code without review.
- No generic token address supplied per escrow.
- No upgradeability for the hackathon MVP unless the repository already has a strong, justified pattern and the security implications are documented.
- Contract must expose the configured token address through a read method or public immutable variable.

### 9.2 Suggested escrow fields

Use efficient types where sensible, but prioritize safety/readability over premature gas optimization.

```solidity
struct Escrow {
    address seller;
    address buyer;          // address(0) means open checkout; first funder becomes buyer
    address resolver;       // fixed at creation; shown before funding
    uint256 amount;         // MUSD base units, 18 decimals
    uint64 fundingDeadline;
    uint64 deliveryDeadline;
    uint32 reviewPeriod;
    uint64 reviewDeadline;  // written when delivery is submitted
    State state;
    string metadataURI;     // immutable/content-addressed JSON URI, verified against metadataHash
    bytes32 termsHash;      // hash of canonical agreement terms
    bytes32 metadataHash;   // hash of canonical title/description metadata
    bytes32 evidenceHash;   // set when seller submits delivery
}
```

The exact struct can change based on contract compiler constraints, but the final fields and meaning must be documented.

### 9.3 Suggested state enum

```solidity
enum State {
    Created,
    Funded,
    Delivered,
    Released,
    Refunded,
    Disputed,
    Cancelled
}
```

Do not reuse a terminal state for a different meaning. Terminal states are `Released` and `Refunded`; `Disputed` is non-terminal until the resolver settles it.

### 9.4 Suggested public functions

- `createEscrow(...) returns (uint256 escrowId)`
  - Only creates a new agreement; does not move funds.
  - `msg.sender` is the seller.
  - Validates amount > 0, buyer/resolver policy, valid timestamps, review period bounds, nonzero hashes, and a valid metadata URI.
  - `fundingDeadline` must be in the future; `deliveryDeadline` must be later than `fundingDeadline` by a minimum interval and within sensible maximum bounds.
  - `metadataURI` must point to the canonical agreement JSON (prefer content-addressed storage); the app verifies the fetched JSON against `metadataHash`.
  - Resolver must be nonzero for the MVP if disputes are enabled.
  - Emits `EscrowCreated` with ID, seller, buyer (can be zero for open link), amount, deadlines, resolver, and hashes.

- `fundEscrow(uint256 escrowId)`
  - Only valid from `Created` and at or before `fundingDeadline`.
  - If a specific buyer was specified, only that address may fund.
  - If buyer is zero, first valid funder becomes the buyer.
  - Uses safe token transfer-from for exactly `amount` MUSD.
  - State changes must follow checks-effects-interactions or a safe reentrancy-protected pattern.
  - Emits `EscrowFunded`.

- `submitDelivery(uint256 escrowId, bytes32 evidenceHash)`
  - Only seller; only in `Funded`; only at/before delivery deadline.
  - Evidence hash must be nonzero.
  - Set evidence hash, `reviewDeadline = block.timestamp + reviewPeriod`, state `Delivered`.
  - Emits `DeliverySubmitted`.

- `releaseToSeller(uint256 escrowId)`
  - Only buyer; only in `Delivered`; before or during valid review rules.
  - Marks state `Released` before transferring MUSD to seller; nonReentrant.
  - Sends exactly the escrow amount to seller.
  - Emits `EscrowReleased`.

- `releaseAfterReviewWindow(uint256 escrowId)`
  - Callable only after `reviewDeadline`, only while state is `Delivered`, and only if no dispute was raised before the review deadline.
  - This is required in the selected MVP policy and must be prominently disclosed before funding.
  - Seller or any caller may invoke it only to execute the deterministic contract outcome; no caller receives funds other than the seller.
  - Emits the standard release event plus any needed reason/code.

- `refundAfterMissedDeadline(uint256 escrowId)`
  - Buyer only; state `Funded`; `block.timestamp > deliveryDeadline`; no delivery has been submitted.
  - Marks `Refunded`, transfers exactly the amount to buyer, emits `EscrowRefunded`.

- `raiseDispute(uint256 escrowId, bytes32 reasonHash)`
  - Only buyer or seller; only in eligible non-terminal states; must be inside the explicit dispute window.
  - Transitions to `Disputed` and blocks all unilateral release/refund routes.
  - Must reject zero/invalid reason hash if required by policy.
  - Emits `DisputeRaised`.

- `resolveDispute(uint256 escrowId, bool paySeller)` for Wave 1
  - Only the `resolver` stored for this escrow; only in `Disputed`.
  - Resolves the full amount to either seller or buyer. Explain this limitation in the UI.
  - Marks terminal state before external token transfer; nonReentrant.
  - Emits `DisputeResolved` and the final release/refund event.

- `cancelUnfunded(uint256 escrowId)`
  - Seller may cancel only while state is `Created` and before it is funded.
  - Any caller may mark an unfunded checkout `Cancelled` after `fundingDeadline`; this must not transfer funds.
  - Must not be possible after funding.
  - Sets the explicit `Cancelled` terminal state and emits `EscrowCancelled`.

- Read methods: `getEscrow(id)`, `nextEscrowId()` or equivalent count, and `musdToken()`.

### 9.5 Fixed MVP policy: auto-release after review window

For this project specification, **choose Option A and implement it consistently**: after the seller submits delivery, the buyer has the configured review window to release or raise a dispute. If the deadline passes without either action, the seller or any caller may execute `releaseAfterReviewWindow`; funds go only to the seller. The caller receives nothing. This avoids indefinite locks but places responsibility on the buyer to review before the deadline.

The UI must disclose this in the agreement summary and immediately before funding: `If you do not release or raise a dispute before the review window ends, the contract allows the seller to finalize payment to themselves.` Add tests for the instant immediately before, exactly at, and immediately after the review deadline. Use the same timestamp comparison in Solidity, UI helper text, tests, and docs. A dispute raised before the review deadline must prevent automatic release.

### 9.6 No hidden owner powers

MVP contract must not have any unrestricted owner function to transfer escrow funds, alter buyer/seller/resolver after funding, change amount/terms, or force arbitrary settlement. If pause is required as a safety control, carefully define what is paused, who can pause, who can unpause, and how users recover funds. Prefer no pause function for a small non-upgradeable MVP unless there is a clear design need.

### 9.7 Events

At minimum, use typed events with escrow ID and fields needed by the UI/indexer:

- `EscrowCreated`
- `EscrowFunded`
- `DeliverySubmitted`
- `DisputeRaised`
- `EscrowReleased`
- `EscrowRefunded`
- `DisputeResolved`
- `EscrowCancelled` if cancellation exists

Emit enough information for auditability without placing private content or personal information on-chain.

### 9.8 Contract invariants

Write tests proving:

- Only expected roles can call each action.
- Amount cannot be zero.
- Wrong buyer cannot fund a restricted escrow.
- An open invoice binds to only one first funder.
- A checkout cannot be funded twice.
- Seller cannot submit delivery after deadline or after terminal state.
- Buyer cannot release before delivery unless a separately documented rule allows it (MVP should not).
- Buyer cannot reclaim after delivery unless the dispute resolver determines refund or the chosen policy explicitly allows it.
- Refund is impossible before missed-delivery conditions are met.
- A disputed escrow cannot be unilaterally released/refunded.
- Only the stored resolver can resolve the dispute.
- Settlement can occur only once.
- Escrow balance cannot be drained by another escrow's operations.
- Reentrancy attempts fail safely.
- Fee-on-transfer/nonstandard tokens are irrelevant because only the configured MUSD token is supported; still verify actual MUSD token behavior before assumptions.
- Contract status and emitted events are consistent.

---

## 10. Dispute Model and Trust Disclosure

Escrow is not automatically trustless simply because the funds sit in a smart contract. The dispute resolver creates a trust assumption.

### Wave 1 resolver model

- A resolver address is set when the seller creates the agreement.
- The buyer sees the resolver address and the full/partial settlement capabilities before funding.
- The resolver cannot change terms or access other escrows.
- The resolver can only settle a specific escrow when it has state `Disputed`.
- The MVP resolver function selects buyer or seller for full refund/release. No partial split in Wave 1 unless specifically tested and approved.
- Use a dedicated testnet demo resolver wallet, not a hardcoded mainnet operator address.

### UI disclosure copy

`If a dispute is raised, the resolver shown here can decide whether the escrowed amount is released to the seller or refunded to the buyer, according to the contract rules. Review the resolver address before funding. MEZO LOOP does not guarantee the quality of off-chain work.`

### Longer-term possibilities

- Resolver directory with publicly documented criteria.
- Multi-sig or multi-resolver arbitration.
- Independent third-party resolvers.
- Multi-party agreement requiring both sides to choose the resolver.
- Partial split settlements and milestone-specific arbitration.

These are future options, not claims about current MVP functionality.

---

## 11. Off-chain Metadata and Evidence Integrity

Some checkout information (title, description, terms text, evidence URL) may be stored off-chain. Avoid putting private messages, customer files, personal information, or confidential work on-chain.

### Required integrity design

- Define a **canonical JSON schema** for agreement metadata.
- Serialize deterministically (stable property order, stable date formats, UTF-8 normalization as appropriate).
- Compute `metadataHash = keccak256(canonicalAgreementBytes)` or another clearly documented digest.
- Store the digest on-chain.
- Store metadata in a configured backend or content-addressed storage. If the storage is mutable, verify the fetched content against the on-chain hash.
- For delivery evidence, compute and store `evidenceHash` on-chain; a URL by itself is not an integrity guarantee.
- If metadata cannot be fetched or its hash mismatches, show a strong warning: `Agreement details could not be verified against the on-chain hash.` Disable new funding if the buyer cannot inspect the actual terms.

### Minimal Wave 1 storage approach

Prefer the simplest robust approach compatible with the current repo:

1. If a backend/database already exists, use it and add integrity verification.
2. If not, consider storing a metadata URI plus hash in the contract, with content uploaded to a configured content-addressed service.
3. If no upload service can be configured in time, use short terms stored in contract metadata or an explicitly limited demo implementation that does not pretend off-chain text is permanent. State limitations clearly.

Never rely only on browser `localStorage` for the canonical terms of a shareable escrow; that would break cross-device access and can produce different terms for buyer and seller.

---

## 12. Frontend Architecture

### Preferred stack (adapt to repository)

- Framework: use existing framework; if blank, Next.js + React + TypeScript.
- Styling: existing design system; otherwise Tailwind CSS with reusable semantic tokens.
- UI primitives: use existing library; otherwise accessible primitives such as shadcn/ui/Radix.
- Web3: `wagmi` + `viem` for EVM wallet connections, contract reads/writes, chain checks, and typed unit conversion. A supported connector library may be used if already configured.
- Server state: TanStack Query if compatible with repository; otherwise a consistent query/cache mechanism.
- Validation: Zod or existing schema validator plus form library if already installed.
- Forms: React Hook Form + schema validation if repository supports it.
- Icons: Lucide or repository's existing icon system.
- Tests: existing test runner; otherwise Vitest/React Testing Library for UI and Foundry or Hardhat for contracts.

Do not install multiple overlapping libraries that solve the same problem.

### Suggested conceptual module structure

Adapt to existing naming conventions; do not force this exact structure onto an established repo.

```text
src/
  app/ or routes/
    page.tsx                         # landing
    dashboard/page.tsx
    create/page.tsx
    checkout/[escrowId]/page.tsx
    escrows/[escrowId]/page.tsx
    receipt/[escrowId]/page.tsx
    activity/page.tsx
    how-it-works/page.tsx
  components/
    layout/                          # header, nav, shell, footer
    wallet/                          # connect, network switch, balance
    checkout/                        # agreement card, fund panel, status timeline
    escrow/                          # escrow facts, actions, dispute panel
    activity/                        # event list, filters, transaction row
    feedback/                        # empty, loading, error, status states
    ui/                              # primitives
  lib/
    chain/                           # chain config, explorer URL helpers
    contracts/                       # ABI, address config, typed read/write functions
    escrow/                          # state mapping, permissions, formatting
    metadata/                        # canonical serialization, hash verification
    validation/                      # form schemas
    utils/                           # amounts, addresses, dates, errors
  hooks/
    useEscrow.ts
    useEscrowEvents.ts
    useMUSD.ts
    useWalletNetwork.ts
  types/
    escrow.ts
contracts/
  src/
  test/
```

If the existing repository uses a different structure, adapt this map and write down the mapping.

### Data flow principles

- Read-only chain queries may be cached, but refetch after every confirmed write.
- Do not persist wallet signatures, private data, or sensitive documents.
- Do not treat front-end status alone as canonical.
- Separate `transaction submitted` from `transaction confirmed` and `state verified`.
- Guard against repeated clicks while the same write is pending.
- Centralize address and chain configuration; never duplicate magic values in individual components.

---

## 13. Smart Contract and Tooling Approach

### Build system

Use the repository's existing contract framework. If there is no contract workspace:

- Choose Foundry or Hardhat and use one consistently.
- Mezo documentation includes configuration examples for Solidity `0.8.28` and EVM version `london`; verify current docs and project compatibility before finalizing.
- Do not import or fork the entire Mezo MUSD protocol. MEZO LOOP is an application contract that interacts with the published MUSD ERC-20 token.
- Use well-reviewed dependencies for ERC-20 safe transfers and reentrancy protection when compatible with the repository.
- Ensure ABI/artifacts are generated deterministically and consumed by the frontend.

### Suggested development commands (adjust to the actual scripts)

- Install repo dependencies using the lockfile's package manager.
- Contract compile.
- Contract unit tests.
- Contract coverage/static analysis where available.
- Frontend lint/type-check/test.
- Production build.
- Deploy to testnet only after unit tests pass.

Document exact commands in the README after verifying they actually work.

### Deployment requirements

- Deploy the escrow contract to Mezo Testnet.
- Store the resulting escrow contract address in environment/configuration.
- Verify token address against official Mezo docs and/or explorer immediately before deployment.
- If contract verification is supported, verify the deployed source/constructor args through the official or compatible explorer workflow.
- Record chain ID, contract address, deployment transaction hash, compiler version, optimizer settings, and ABI version in deployment metadata.
- Do not commit private keys or `.env` files.

---

## 14. Mezo Network Configuration

**Verify these values against the official documentation again before use. Do not assume testnet and mainnet addresses are interchangeable.**

### Mezo Testnet (development default)

- Chain ID: `31611`
- RPC: `https://rpc.test.mezo.org`
- WebSocket RPC: `wss://rpc-ws.test.mezo.org`
- Explorer base: `https://explorer.test.mezo.org`
- Native gas currency: `BTC` (Mezo EVM network gas currency; do not relabel as ETH in the UI)
- MUSD token (as listed in official Mezo docs): `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- Token decimals: 18 (verify by calling `decimals()` when the app initializes/deploys)

### Mezo Mainnet (not the Wave 1 default)

- Chain ID: `31612`
- Public RPC listed in current docs includes `https://mezo-mainnet.boar.network`; alternative providers may be listed in official docs.
- Explorer base: `https://explorer.mezo.org`
- MUSD token (as listed in official Mezo docs): `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`

### Important testnet funding note

The official Mezo x402 quickstart states that testnet MUSD is obtained by borrowing against testnet BTC, not simply by receiving it from a faucet. It also notes a minimum borrow requirement in the relevant workflow. Check the current instructions because this may change. Link users to the official documentation rather than hardcoding a potentially outdated amount in the UI.

### Config design

Use one configuration module, with environment variables where deployment addresses depend on environment:

- `NEXT_PUBLIC_CHAIN_ENV=testnet`
- `NEXT_PUBLIC_MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org`
- `NEXT_PUBLIC_MUSD_TESTNET_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- `NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS=` (populate only after verified deployment)
- `NEXT_PUBLIC_EXPLORER_BASE_URL=https://explorer.test.mezo.org`

These variable names are examples; adapt to the current repository. Validate addresses on startup and fail visibly if a required deployment value is absent. Do not fall back to a made-up contract address.

### Explorer URL helpers

Centralize helpers for:
- transaction URL: `{explorerBase}/tx/{hash}` if that explorer's route format has been verified;
- address URL: `{explorerBase}/address/{address}` if verified;
- contract URL.

Verify the current explorer route syntax before release. If unsure, link to the explorer homepage with a copyable hash/address rather than generating a broken URL.

---

## 15. MUSD Handling and Numeric Safety

MUSD uses 18 decimal places according to the official documentation. Handle all amounts as integer base units (`bigint`) internally.

### Rules

- Never use JavaScript floating-point arithmetic for token amounts or payment comparisons.
- Use `parseUnits(input, 18)` and `formatUnits(value, 18)` (or equivalent) from a proven library.
- Validate the user's input before parsing and handle values that exceed safe range or contract limits.
- Never round silently when a value would change the transaction amount.
- Show a human-readable amount and a confirmation detail that makes the exact token amount clear.
- Use a consistent display precision; hide trailing zeroes only in presentation, never in on-chain values.
- Re-read `balanceOf`, `allowance`, and escrow state after successful transactions.
- If `decimals()` differs from configuration, stop the flow and show a configuration warning rather than proceeding.

---

## 16. Wallet and Transaction UX

### Wallet state model

Represent these states explicitly:
- disconnected
- connecting
- connected on supported chain
- connected on wrong chain
- connection error
- wallet locked/unavailable

### Transaction state model

For every write action, display a precise phase:
1. Ready
2. Awaiting wallet approval
3. Submitted (hash exists)
4. Confirming
5. Confirmed
6. Failed / Reverted
7. Unknown status (e.g. receipt timeout; offer retrying read, not a second transaction by default)

### Error message patterns

- User rejected: `You cancelled the wallet request. No change was confirmed on-chain.` Verify when possible; do not state no change if the transaction had already been submitted.
- Wrong chain: `Switch to Mezo Testnet to continue.`
- Insufficient MUSD: `Your wallet does not have enough MUSD for this payment.` Show actual balance and shortfall.
- Insufficient native gas: `Your wallet may not have enough BTC for network gas.` Only say this when the wallet/provider indicates it; do not confuse gas currency with payment token.
- Contract revert: map known custom errors to helpful text; fall back to a safe generic message with `More details`.
- RPC timeout: `The network did not confirm the result yet. Check transaction status before retrying.`
- Metadata hash mismatch: stop funding and show a prominent warning.

Never display raw stack traces by default; preserve them in developer console/logging without exposing secrets.

---

## 17. Design System and Component Detail

Build reusable components with a consistent state API, not one-off styled divs.

### Base components

- `Button`: primary, secondary, ghost, danger; disabled and loading states; visible focus.
- `Card`: default/elevated/interactive variants.
- `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup` with labels and helper/error text.
- `Badge`: state label plus icon.
- `Tooltip` and `InfoHint` for terms like escrow, MUSD, resolver.
- `Dialog/Drawer`: wallet transaction confirmation, dispute detail, or mobile sheet.
- `Skeleton`: data loading.
- `EmptyState`: meaningful first-use state.
- `ErrorPanel`: error, cause if known, retry, support/doc link.
- `CopyButton`: copies only the displayed value and reports success.
- `ExternalLink`: opens verified URLs safely.

### Domain components

- `WalletButton`
- `NetworkStatusBadge`
- `MUSDBalance`
- `EscrowStatusBadge`
- `EscrowProgressTimeline`
- `AgreementSummaryCard`
- `PartyAddressRow`
- `DeadlineDisplay`
- `TransactionStatusPanel`
- `EvidenceSubmissionForm`
- `DisputeResolverPanel`
- `EscrowActionPanel`
- `ExplorerLink`
- `ReceiptSummary`

### Status mapping

Map contract enum values in one location. Suggested semantics:

- `Created` → Neutral / `Awaiting funding`
- `Cancelled` → Neutral / `Cancelled`
- `Funded` → Info / `Funds secured`
- `Delivered` → Warning / `Review required`
- `Disputed` → Danger or warning / `Disputed`
- `Released` → Success / `Paid to seller`
- `Refunded` → Neutral/success / `Refunded to buyer`

Use the same label everywhere, including filters, detail page, receipt, and events.

### Accessibility

- Keyboard-accessible navigation and dialogs.
- Focus ring visible against dark surfaces.
- Correct form labels and error associations.
- Do not use placeholder-only fields.
- `aria-live` for transaction status changes that need to be announced.
- Respect reduced motion.
- Color contrast should be checked for small text and badges.
- Screen-reader labels for copy buttons, address abbreviations, icons, and transaction state.

---

## 18. Backend / Indexing / Data Decisions

A smart contract cannot by itself provide a convenient, fast, cross-device dashboard without reading events or storing metadata. Choose the lightest viable approach based on the repo.

### Wave 1 option

- Query recent contract events from the escrow contract deployment block using `getLogs`/viem with safe range limits, or use an existing indexer if already configured.
- Add pagination or bounded range. Do not request the entire chain history on every page load.
- Fetch details per escrow ID and verify current state through contract reads.
- Cache read results, then invalidate after any write.
- Store noncritical UI preferences locally, but never treat local storage as the canonical agreement or chain status.

### Optional metadata service

If there is already a backend/database, use it for metadata URI mapping and indexing. Otherwise, do not add a new production service unless the Wave 1 implementation genuinely requires it. If Supabase, IPFS pinning, Pinata, or another service is chosen:
- document why it is needed;
- make credentials environment variables;
- validate uploaded content;
- handle unavailable service and rate limits;
- verify content against on-chain hash;
- do not expose server secrets in client-side environment variables.

### Source of truth hierarchy

1. **Canonical payment state and funds:** deployed escrow contract.
2. **Agreement integrity:** on-chain metadata/terms hash verified against fetched canonical metadata.
3. **Convenient list/search data:** event index/cache/backend, checked against on-chain reads.
4. **Local UI cache:** never canonical.

---

## 19. Security Threat Model

This is a minimum list; expand it after code review.

### Smart contract risks

- Reentrancy during token transfers.
- Unauthorized release/refund/resolve calls.
- Replay or duplicate settlement attempts.
- Wrong or mutable token address.
- Incorrect deadline comparison (`>` vs `>=`) and timestamp edge cases.
- Funds locked forever due to missing dispute path.
- Arbitrator abuse or resolver address confusion.
- Overflow/underflow (Solidity 0.8 helps, but do not rely on that alone).
- Malicious or unexpected ERC-20 behavior.
- Incorrect contract state update order.

### Frontend risks

- Wrong chain or malicious contract address.
- UI displays wrong amount because of decimal conversion bug.
- Stale state enables an invalid transaction.
- Duplicate clicks generate duplicate requests.
- Explorer links to wrong network.
- Metadata changed after funding.
- A third-party URL opens a phishing site.
- Rendering untrusted descriptions with unsafe HTML.
- Leakage of sensitive information in logs or query parameters.

### Mitigations

- Immutable verified token address.
- Strong unit tests and fuzz/invariant testing where possible.
- NonReentrant and safe transfer patterns.
- Role checks and explicit state transitions.
- Centralized, environment-specific contract config.
- Wallet chain verification before writes.
- Input validation both frontend and contract.
- Metadata hash verification before funding.
- Use text rendering, not untrusted HTML injection.
- Open external links with safe browser attributes.
- No secret keys in the browser app or repo.
- Deployment checklist and testnet demo before judging.

---

## 20. Testing and Acceptance Criteria

### 20.1 Contract tests

Minimum tests:

- Creation with valid parameters.
- Revert on zero amount, invalid addresses, invalid deadline, invalid review duration.
- Restricted buyer cannot be replaced by another wallet.
- Open checkout binds exactly one funder.
- Only buyer can fund restricted escrow.
- MUSD allowance/balance path behaves correctly.
- Exact funds are transferred into the escrow.
- Seller can submit evidence only in correct state and before deadline.
- Buyer can release after delivery within allowed window.
- Buyer cannot release somebody else's escrow.
- Correct refund conditions after missed delivery.
- Review-window default matches documented policy.
- Dispute freezes unilateral settlement.
- Wrong resolver cannot resolve.
- Correct resolver can resolve only disputed escrows.
- No terminal escrow can be settled again.
- State updates and event values are correct.
- No unrelated escrow funds can be taken.
- Reentrancy / malicious token mock tests if supported.
- Boundary tests for exact deadline and review deadline timestamps.

### 20.2 Frontend tests

- Disconnected wallet state.
- Wrong chain state and switch flow.
- Buyer restriction state.
- Low MUSD balance state.
- Insufficient allowance → approve → confirm → re-read allowance.
- Create checkout field validation.
- Transaction rejected.
- Transaction submitted but pending.
- Receipt confirmed.
- Stale cache refetch after confirmed write.
- Metadata hash mismatch blocks funding.
- Seller-only and buyer-only actions appear only for correct roles.
- Every contract state renders a sensible badge/action panel.
- Mobile navigation and checkout are usable at narrow widths.

### 20.3 End-to-end testnet demo

Use two separate wallet accounts: seller and buyer.

1. Deploy contract to Mezo Testnet using the verified testnet MUSD address.
2. Confirm deployed contract address and constructor token via explorer/read call.
3. Seller creates a checkout for a small test amount.
4. Buyer opens the checkout link in a separate browser/account.
5. Buyer approves and funds with MUSD.
6. Verify transfer/event/state on the explorer and in app.
7. Seller submits evidence.
8. Buyer releases.
9. Create a second escrow and exercise the timeout refund path.
10. If dispute is implemented in Wave 1, create a third escrow and test resolver settlement.
11. Re-load pages on another device/browser to verify details do not depend on local state.

### 20.4 Definition of Done

The MVP is not done until:
- A real testnet transaction works end to end.
- Contract state and UI agree after each transition.
- There are no obvious dead buttons, decorative-only actions, or fake balances.
- Core failure states have clear messaging.
- Responsive layout is usable on desktop and mobile.
- Lint/type-check/tests/build pass, or remaining failures are documented accurately.
- README explains setup, network, deployment configuration, tests, security limitations, and the demo flow.

---

## 21. Implementation Plan by Milestone

### Milestone 0 — Repository audit

Deliver:
- Stack and architecture summary.
- Existing routes/components/contracts.
- Missing integrations and broken scripts.
- Whether there is already a deployed escrow contract.
- File-by-file plan that fits the existing project.

### Milestone 1 — Design system and app shell

Build:
- Theme tokens.
- Typography, buttons, fields, cards, badges, dialogs.
- Header/sidebar/mobile navigation.
- Landing page and how-it-works page.
- Responsive layouts and empty/loading/error states.

Acceptance: no dead links or CTAs; no fabricated chain data.

### Milestone 2 — Contract and unit tests

Build:
- MUSD-specific escrow contract.
- State machine and events.
- Test suite for all invariants.
- ABI/artifact integration.

Acceptance: tests pass locally; disputed/timeout/default policy is explicit and consistent.

### Milestone 3 — Wallet, network, and read integration

Build:
- Wallet connection.
- Mezo Testnet config and chain switching.
- MUSD token contract reads: decimals, balance, allowance.
- Escrow details, status mapping, event list, explorer links.

Acceptance: wrong chain and RPC failure are handled clearly.

### Milestone 4 — Create and fund flows

Build:
- Create checkout wizard.
- Agreement hash creation and metadata loading/verification.
- Wallet creation transaction.
- Buyer funding path with allowance handling.
- Transaction lifecycle states.

Acceptance: seller and buyer can use separate wallets in a real testnet demo.

### Milestone 5 — Delivery, settlement, and receipt

Build:
- Delivery evidence submission.
- Buyer release.
- Timeout refund.
- Dispute and resolver flow if included in Wave 1.
- Receipt page and copy actions.

Acceptance: each available action matches contract permissions and state.

### Milestone 6 — Hardening and buildathon submission

Build/verify:
- Mobile polish and accessibility.
- Error states and retry behavior.
- Contract/UI test coverage.
- README and deployment docs.
- GitHub cleanliness and environment file template.
- Demo script and 2-minute pitch outline.

Acceptance: all submission artifacts are real, and demo is reproducible by another team member.

### Milestone 7 — Wave 2 expansion (after Wave 1 review)

Prioritize based on feedback:
1. Partial dispute settlement and/or milestone payments.
2. Better transaction event indexing and receipts.
3. x402 compatibility where it adds value beyond an ordinary paid request.
4. Agent spending rules with constrained permissions.
5. Verified DeFi treasury integration only when technically and economically justified.

---

## 22. Product Copy Library

Use consistent copy across app screens.

### General
- `Protected MUSD checkout`
- `Payments that follow the deal.`
- `Review the terms before you fund.`
- `Funds are controlled by the escrow contract and follow the rules shown here.`
- `On-chain status`
- `View on explorer`

### Funding
- `Approve MUSD` — token approval only, not funding.
- `Fund escrow` — sends MUSD into the escrow contract.
- `Funding locks the amount under the agreement rules. Review the deadline and resolver before continuing.`

### Delivery
- `Submit delivery evidence`
- `The evidence hash helps verify that the referenced evidence has not changed. It does not prove the work meets the agreement.`

### Release
- `Approve delivery & release funds`
- `This releases the escrowed MUSD to the seller under the contract rules.`

### Refund
- `Refund after missed deadline`
- `This action is available only if the on-chain escrow is eligible under its delivery-deadline rule.`

### Dispute
- `Raise a dispute`
- `A dispute pauses unilateral settlement. The resolver listed in this agreement can decide the outcome allowed by the contract.`

### Safety
- `MEZO LOOP does not guarantee the quality of off-chain work or eliminate all counterparty risk.`
- `Check the network, amount, parties, deadlines, and resolver before signing.`

---

## 23. Environment Variables and Secrets

Use a `.env.example` with placeholders only. Exact names should match the repository.

```dotenv
# Public frontend config only
NEXT_PUBLIC_CHAIN_ENV=testnet
NEXT_PUBLIC_MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org
NEXT_PUBLIC_MUSD_TESTNET_ADDRESS=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS=
NEXT_PUBLIC_EXPLORER_BASE_URL=https://explorer.test.mezo.org

# Optional metadata/indexer integrations, only if implemented
# METADATA_STORAGE_URL=
# METADATA_STORAGE_API_KEY=
# DATABASE_URL=

# Deployment-only secrets. Never prefix server secrets with NEXT_PUBLIC_.
# DEPLOYER_PRIVATE_KEY=
# PRIVATE_RPC_API_KEY=
```

Rules:
- Never commit `.env`.
- Never use a production private key in front-end code.
- Do not add secrets to `NEXT_PUBLIC_*` variables.
- For local/testnet deployment, use a dedicated test wallet with no real value.
- Missing required addresses should cause a helpful configuration error, not a fallback to a fake value.

---

## 24. README and Submission Deliverables

README must include:

1. What MEZO LOOP is and which user problem it solves.
2. What is actually implemented in Wave 1 vs planned for Wave 2.
3. Architecture diagram (frontend, wallet, escrow contract, MUSD token, explorer/event reads, optional metadata store).
4. Tech stack and verified commands.
5. Local setup and `.env.example` instructions.
6. Mezo Testnet network details and links to official docs.
7. Contract address and deployment transaction only after a real deployment.
8. How to acquire testnet MUSD using the official Mezo instructions.
9. How to run contract and frontend tests.
10. Known risks and limitations, including resolver trust and non-audited status.
11. Demo script with seller and buyer wallet roles.
12. Roadmap and measurable Wave 2 improvements.

Buildathon deliverables from the provided brief include a live testnet/mainnet project link, public GitHub repository, deck, two-minute pitch video, and the submission form details. Verify the latest official requirements before submission.

### Suggested 2-minute demo narrative

- 0:00–0:15 — Problem: a normal payment moves money but does not encode a delivery agreement.
- 0:15–0:35 — Seller creates a checkout with amount, terms, deadline, review window, and resolver.
- 0:35–0:55 — Buyer opens it, checks the terms, approves MUSD, and funds the escrow.
- 0:55–1:15 — Show the real transaction/event on Mezo Testnet and the app status changing from the chain.
- 1:15–1:35 — Seller submits delivery evidence; buyer releases or demonstrate a valid timeout/refund scenario.
- 1:35–1:50 — Explain the value to freelancers, digital service providers, and Mezo MUSD adoption.
- 1:50–2:00 — Roadmap: staged payments, more robust dispute design, and carefully verified integrations.

Do not spend the pitch on features that have not been implemented.

---

## 25. Official References to Verify During Development

Use official documentation as the source of truth and re-check it before deployment. Addresses, network configuration, SDK behavior, and product availability can change.

- Mezo developer docs: https://mezo.org/docs/developers/
- Mezo developer getting started: https://mezo.org/docs/developers/getting-started/
- Mezo Testnet setup / RPC / chain information: https://testnet.mezo.org/docs/developers/getting-started/configure-environment/
- Connect wallet / network details: https://testnet.mezo.org/docs/users/getting-started/connect
- Official contract and token address reference: https://mezo.org/docs/users/resources/contracts-reference
- MUSD development guide: https://testnet.mezo.org/docs/developers/musd/
- MUSD smart contracts repository: https://github.com/mezo-org/musd
- MUSD payments with x402 overview: https://mezo.org/docs/developers/getting-started/musd-payments-x402/
- x402 quickstart: https://testnet.mezo.org/docs/developers/getting-started/musd-payments-x402/x402-quickstart/
- Mezo Testnet app: https://testnet.mezo.org
- Mezo Testnet faucet: https://faucet.test.mezo.org/
- Mezo Testnet explorer: https://explorer.test.mezo.org/
- Mezo Discord: https://discord.mezo.org
- Mezo GitHub organization: https://github.com/mezo-org/

### Source-of-truth note

The Mezo x402 documentation describes HTTP-native MUSD payments and paid API/agent use cases. MEZO LOOP should not claim that ordinary pay-per-request payments are new. Its Wave 1 distinction is the **agreement-aware escrow lifecycle**: parties, deadlines, evidence reference, review rules, and transparent release/refund/dispute outcomes.

---

## 26. Final Acceptance Checklist for Cursor

Before declaring the project ready, confirm each item:

### Product
- [ ] The user can explain the product in one sentence.
- [ ] The primary action is obvious on every route.
- [ ] Wave 1 stays focused on protected MUSD checkout.
- [ ] Buyer and seller responsibilities are explicit.
- [ ] Resolver powers and timeout rules are disclosed before funding.

### Design
- [ ] Consistent design tokens and components.
- [ ] Premium, restrained fintech aesthetic rather than generic crypto template.
- [ ] Responsive from mobile to desktop.
- [ ] Empty, loading, error, wrong-network, and transaction-pending states designed.
- [ ] No fake data presented as real.
- [ ] Accessible form labels, keyboard navigation, and visible focus.

### On-chain
- [ ] Verified target MUSD address and chain configuration.
- [ ] No user-supplied token address per transaction.
- [ ] Tests for all contract state transitions and authorization rules.
- [ ] No hidden admin withdrawal path.
- [ ] Reentrancy-safe transfer logic and state updates.
- [ ] Deadline boundary behavior tested.
- [ ] Dispute resolution has a terminal settlement path.
- [ ] Real testnet deployment verified by explorer/read call.

### Frontend integration
- [ ] Reads are derived from the actual chain.
- [ ] Contract address/ABI comes from one config source.
- [ ] MUSD balance, allowance, and decimals are read from token contract.
- [ ] Token amount conversion uses integer/bigint math.
- [ ] Write status distinguishes submitted from confirmed.
- [ ] UI refreshes state after transactions.
- [ ] Wrong chain / RPC errors have clear recovery actions.
- [ ] Terms/evidence hash mismatch prevents funding or is clearly blocking.

### Shipping
- [ ] Lint/type-check/tests/build run and results documented.
- [ ] `.env.example` contains no secrets.
- [ ] README setup and demo instructions are reproducible.
- [ ] Public repository does not include keys or private user data.
- [ ] Submission says only what actually works.

---

## Final direction

**Build MEZO LOOP as a polished MUSD payment experience, but make LoopGuard's contract-backed agreement lifecycle the hero.** A smaller flow that works, is easy to understand, and can be verified on-chain is more valuable than a wide dashboard filled with unimplemented modules. Use Wave 1 to prove the core escrow lifecycle; use Wave 2 to expand only in response to technical feasibility, user feedback, and buildathon judging feedback.

---

## 27. Copy-Paste Prompt for Cursor (Grok 4.7)

Use this prompt with the repository open in Cursor and this file added to the project context:

> Read `MEZO_LOOP_PROJECT_OVERVIEW.md` completely and treat it as the product specification. Act as a senior product designer, full-stack Web3 engineer, Solidity engineer, and QA/security-minded reviewer.
>
> **First inspect the existing repository without editing files.** Identify the framework, routes, styling system, wallet/web3 integration, contracts, tests, package manager, existing deployment information, and current functionality. Do not assume it is a blank project, and do not rewrite working modules unnecessarily.
>
> Then create a concise audit and a file-by-file implementation plan that maps the current repository to the specification. Call out any unknown that must be verified from official Mezo documentation, especially token/contract addresses, RPC configuration, x402 SDK behavior, and deployed contract ABIs. Do not invent missing values.
>
> Design the app around the Wave 1 scope: a real, responsive LoopGuard protected MUSD checkout. Prioritize the landing page, create-checkout wizard, public checkout, wallet/network states, MUSD approval/funding, delivery evidence, buyer release, missed-delivery refund, documented auto-release after the review window, dispute/resolver flow, event timeline, and receipt. Use the specified visual direction and build a complete set of loading, empty, error, wrong-chain, pending-transaction, and success states. Do not show mock chain data as real.
>
> Implement in small milestones. Preserve the existing stack if it is healthy; if the repository is blank, choose a minimal, compatible stack and justify it. Build the contract and tests before relying on its ABI in the frontend. Test all role restrictions, deadlines, state transitions, dispute paths, and duplicate-settlement/reentrancy cases. Use MUSD Testnet configuration verified against the official docs and deploy to Testnet only. Never deploy to mainnet or access real funds without explicit instruction.
>
> Use bigint/token-safe arithmetic for 18-decimal MUSD. Re-read contract state after transactions; distinguish a submitted transaction from a confirmed transaction. Treat the on-chain escrow as the canonical source of payment state and verify agreement/evidence metadata hashes. Do not collect or expose private keys or seed phrases. Do not add a hidden owner withdrawal path.
>
> After each milestone, run the applicable tests, lint/type-check, and production build. Fix errors rather than suppressing them. Update the README with exact setup, configuration, test, and testnet-demo instructions. Finish by reporting what is actually implemented, verified, unverified, and still blocked. Never claim an audit, a deployment, or a working integration unless you verified it.
>
> Do not stop after producing a generic plan: complete the repository audit first, then implement the highest-priority working scope unless a genuine missing dependency or a security blocker prevents progress. If blocked, explain the exact blocker and complete all independent work that remains safe.
