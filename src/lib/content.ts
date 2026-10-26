export const FAQ = [
  {
    question: "Who controls the funds?",
    answer: "The escrow contract holds the MUSD. This app prepares the transaction and reads the result. It cannot move the balance on its own.",
  },
  {
    question: "Can the seller withdraw early?",
    answer: "No. The buyer releases after delivery. If the review window ends with no release and no dispute, anyone can finalize payment to the seller. The caller is not paid.",
  },
  {
    question: "When can a buyer get a refund?",
    answer: "After the delivery deadline, and only if the seller submitted nothing. At the exact deadline the seller can still deliver.",
  },
  {
    question: "What does the dispute resolver do?",
    answer: "A dispute stops release, refund, and automatic finalizing. The named resolver then pays one side in full, or splits the amount so the seller receives a stated part and the buyer receives the rest.",
  },
  {
    question: "What is a milestone plan?",
    answer: "Two to five stages. Each stage is a separate agreement with its own amount and delivery deadline. Funding one stage does not fund the others.",
  },
  {
    question: "Can another wallet fund for me?",
    answer: "Yes, if you name that wallet as an agent and set a remaining MUSD cap. The agent can fund agreements that already name you, using your existing approval. The agent cannot release, refund, or dispute.",
  },
  {
    question: "Does RELAY guarantee the work or a refund?",
    answer: "No. The contract enforces its deadlines and who is allowed to call. It does not judge whether the work is acceptable.",
  },
  {
    question: "Which wallets and network does this use?",
    answer: "An injected wallet on Mezo Testnet, chain 31611. Gas is BTC. Mainnet is off. Testnet MUSD is borrowed, not dispensed by the faucet.",
  },
  {
    question: "What fees are there?",
    answer: "No protocol fee. Your wallet shows the BTC network fee before you sign.",
  },
];

export const FEATURE_CARDS = [
  {
    label: "Buyers",
    tone: "meadow" as const,
    mark: "lock" as const,
    copy: "Read the seller, amount, deadlines, and resolver before you connect. MUSD moves only after you fund that agreement.",
  },
  {
    label: "Sellers",
    tone: "brand" as const,
    mark: "planet" as const,
    copy: "One checkout link, or a milestone plan. Each stage has its own amount and delivery deadline.",
  },
  {
    label: "Evidence",
    tone: "meadow" as const,
    mark: "hash" as const,
    copy: "A delivery note and an optional link. The contract stores the text and a hash of it.",
  },
  {
    label: "Refunds",
    tone: "brand" as const,
    mark: "clock" as const,
    copy: "If the delivery deadline passes with nothing submitted, the buyer can refund the full amount.",
  },
  {
    label: "Disputes",
    tone: "meadow" as const,
    mark: "scale" as const,
    copy: "Either party can dispute during review. The resolver pays one side, or splits the amount.",
  },
  {
    label: "Agents",
    tone: "brand" as const,
    mark: "agent" as const,
    copy: "Cap another wallet. It can fund agreements that name you, and it cannot release or refund.",
  },
];

export const HOW_STEPS = [
  { title: "Agree", copy: "Amount, buyer, deadlines, review window, and resolver. A milestone plan creates one agreement per stage." },
  { title: "Fund", copy: "The buyer approves MUSD if needed, then deposits the exact amount. An agent can fund inside a budget." },
  { title: "Deliver", copy: "The seller submits a note and an optional link at or before the delivery deadline." },
  { title: "Release", copy: "The buyer pays the seller, either party disputes, or the review window can finalize payment." },
];

export const PRODUCT_NOTES = [
  { title: "Milestones", copy: "Each stage is funded, delivered, and released on its own." },
  { title: "Agent budgets", copy: "A named wallet funds up to a cap. You stay the buyer." },
  { title: "Split settlement", copy: "The resolver can divide a disputed amount between both sides." },
  { title: "Receipts", copy: "Seller pages, receipts, and activity read the same on-chain agreements." },
];
