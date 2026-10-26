export const DOC_SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    lead: "RELAY is a non-custodial checkout for MUSD. The website prepares transactions. The escrow contract holds the tokens and decides which state changes are allowed.",
    points: [
      "A seller creates an agreement with an amount, deadlines, a review window, and a resolver.",
      "A buyer can read that agreement before connecting a wallet.",
      "Funding pulls the exact MUSD amount into the contract. Direct transfers to the contract address are not credited.",
      "Release, refund, dispute, and split are separate calls. Each one checks the caller, the state, and the clock.",
    ],
  },
  {
    id: "parties",
    title: "Parties",
    lead: "Every agreement stores three addresses. The contract does not let those roles swap after creation.",
    points: [
      "Seller: creates the agreement, submits delivery, and can cancel it before it is funded. After the funding deadline, anyone can cancel an agreement that is still unfunded.",
      "Buyer: approves MUSD, funds the agreement, releases payment, refunds a missed delivery, and can raise a dispute. On an open link, the first allowed funder becomes the buyer.",
      "Resolver: does nothing during a normal payment. After a dispute, only this address can pay the seller, refund the buyer, or split the amount.",
      "The resolver cannot be the seller or the designated buyer. The seller and the resolver cannot fund an open agreement.",
    ],
  },
  {
    id: "create",
    title: "Create an agreement",
    lead: "Create asks for the terms before any token moves. The contract stores hashes of the title, description, and terms, plus the text itself.",
    points: [
      "Choose one payment, or a milestone plan of two to five stages. Each stage is its own agreement, with its own amount and delivery deadline.",
      "Name a buyer, or leave the link open so the first funder becomes the buyer.",
      "The funding deadline must be at least five minutes ahead. The delivery deadline must be at least one hour after the funding deadline. Both must fall within 365 days.",
      "The review window is 15 minutes to 30 days. It starts when delivery is submitted, not when the agreement is created.",
      "The terms text is limited to 2,048 bytes. If the stored text does not match the stored hash, the checkout refuses to fund.",
    ],
  },
  {
    id: "fund",
    title: "Fund",
    lead: "Funding is a two-step wallet flow when the current MUSD approval is below the agreement amount.",
    points: [
      "The buyer approves the escrow contract to spend MUSD, then calls fund. The contract pulls the exact amount and rejects a token that delivers a different balance.",
      "Funding is allowed at the funding deadline and is refused one second later.",
      "An open agreement has no buyer until the first successful fund. That funder is stored as the buyer.",
      "An agent can fund only when the agreement already names the buyer, the agent has a remaining budget, and the buyer has approved the escrow. The agent does not become the buyer.",
    ],
  },
  {
    id: "delivery",
    title: "Delivery",
    lead: "Delivery is a note and an optional link from the seller. It is not a file upload, and it does not prove the work is acceptable.",
    points: [
      "The seller can submit at or before the delivery deadline, while the agreement is funded.",
      "The note is limited to 800 bytes. The contract stores the text and a hash of that text.",
      "Submitting delivery starts the review window and moves the agreement to Delivered.",
      "After a valid delivery, the missed-delivery refund is no longer available.",
    ],
  },
  {
    id: "release",
    title: "Release and refund",
    lead: "The full amount can leave the contract without a dispute in three cases.",
    points: [
      "The buyer can release the full amount to the seller at or before the review deadline.",
      "If the delivery deadline passes and nothing was submitted, the buyer can refund the full amount. At the exact delivery deadline the seller can still deliver, and the refund is not open yet.",
      "If the review deadline passes with no release and no dispute, anyone can finalize payment to the seller. The caller is not paid.",
      "At the exact review deadline the buyer can still release and either party can still dispute. Finalizing opens on the next second.",
      "There is no protocol fee. The wallet shows the BTC network fee for the transaction.",
    ],
  },
  {
    id: "disputes",
    title: "Disputes and splits",
    lead: "A dispute freezes release, refund, and automatic finalizing. RELAY does not decide who is right.",
    points: [
      "The buyer or the seller can raise a dispute at or before the review deadline, with a public reason of up to 280 bytes.",
      "Only the resolver stored on that agreement can settle it.",
      "A full settlement sends the entire amount to the seller or the entire amount to the buyer.",
      "A split sends the seller a stated amount and the buyer the remainder. Neither side can receive the full amount through the split. Use a full settlement for that.",
      "The current testnet escrow supports splits. An older deployment does not, and the split action stays hidden there.",
    ],
  },
  {
    id: "agents",
    title: "Agent budgets",
    lead: "A buyer can let another address fund agreements that already name that buyer, up to a remaining cap.",
    points: [
      "Set budget replaces the remaining cap for that agent. Zero revokes it. The agent cannot be the buyer’s own address.",
      "The budget does not approve MUSD. The buyer still approves the escrow contract. Each agent fund lowers the cap by the agreement amount.",
      "The agent cannot release, refund, dispute, or change the buyer.",
      "Open links cannot be funded by an agent, because they have no stored buyer yet.",
      "The seller, the resolver, and the buyer cannot call the agent fund function.",
      "If the connected escrow was deployed before this function, the call reverts. The form stays off and does not treat that revert as a saved budget.",
    ],
  },
  {
    id: "records",
    title: "Receipts, profiles, and activity",
    lead: "The pages below read the same contracts. They do not keep a separate balance.",
    points: [
      "Dashboard lists agreements for the connected wallet and can look one up by id or seller address.",
      "A seller page lists agreements that name that seller.",
      "A receipt page and the receipt link on an agreement show the on-chain result after funding closes.",
      "Activity lists contract events. Open uses the contract address as well as the id, because older agreements can share an id with a newer deployment.",
      "The activity index starts at the earliest escrow deployment so older agreements stay visible.",
    ],
  },
  {
    id: "x402",
    title: "Machine-readable checkout",
    lead: "GET /api/x402/agreements/{id} is a status endpoint for the agreement. It is not a way to send MUSD by itself.",
    points: [
      "While the agreement is still awaiting funds and the funding deadline has not passed, the response is HTTP 402 with the amount, asset, and fund instruction.",
      "After that, the response is HTTP 200 with the on-chain receipt: state, amount, parties, hashes, and links to the checkout and receipt pages.",
      "An unknown id returns 404. A direct token transfer to the escrow still does not fund an agreement.",
    ],
  },
  {
    id: "limits",
    title: "Limits",
    lead: "These bounds are enforced by the contract and by the create form.",
    points: [
      "Review window: 15 minutes to 30 days.",
      "Delivery deadline: at least one hour after the funding deadline, and within 365 days.",
      "Funding deadline: at least five minutes ahead in the form, so the transaction has time to be mined.",
      "Terms text: 2,048 bytes. Delivery note: 800 bytes. Dispute reason: 280 bytes.",
      "Milestone plans in the form: 2 to 5 stages.",
      "MUSD uses 18 decimals. The amount pulled must match the amount stored on the agreement.",
    ],
  },
] as const;

export const DOC_STATES = [
  { from: "Created", to: "Funded", by: "Buyer, open funder, or allowed agent", when: "At or before the funding deadline" },
  { from: "Created", to: "Cancelled", by: "Seller, or anyone after the funding deadline", when: "Still unfunded" },
  { from: "Funded", to: "Delivered", by: "Seller", when: "At or before the delivery deadline" },
  { from: "Funded", to: "Refunded", by: "Buyer", when: "After the delivery deadline, with no delivery" },
  { from: "Delivered", to: "Released", by: "Buyer, or anyone after review", when: "Buyer: at or before the review deadline. Anyone: after it, if there is no dispute" },
  { from: "Delivered", to: "Disputed", by: "Buyer or seller", when: "At or before the review deadline" },
  { from: "Disputed", to: "Released", by: "Resolver", when: "Full payment to the seller" },
  { from: "Disputed", to: "Refunded", by: "Resolver", when: "Full refund to the buyer" },
  { from: "Disputed", to: "Split", by: "Resolver", when: "Seller receives a stated part and the buyer receives the rest" },
] as const;

export const DOC_LIMITATIONS = [
  "This contract has not been independently audited. Tests are not an audit.",
  "The resolver is trusted for disputed agreements. Choose that address deliberately.",
  "Evidence and dispute text are public. Do not put secrets or personal data on chain.",
  "A link in the delivery note can change or disappear. The hash only covers the text that was submitted.",
  "Tokens sent directly to the contract are not credited and cannot be rescued. There is no admin withdrawal.",
  "Mainnet is not enabled. This app transacts on Mezo Testnet, chain 31611, or on a local Hardhat chain.",
  "Gas is BTC. Testnet MUSD is borrowed. The faucet dispenses testnet BTC, not MUSD.",
  "Older escrow deployments stay readable. They do not gain split settlement or agent budgets after they are deployed.",
] as const;
