export const FAQ = [
  {
    question: "Who controls the funds?",
    answer: "The escrow contract holds the MUSD. This app only prepares the transaction.",
  },
  {
    question: "Can the seller withdraw early?",
    answer: "No. The buyer releases after delivery. If review ends with no action, anyone can finalize payment to the seller.",
  },
  {
    question: "When can a buyer get a refund?",
    answer: "Only after a missed delivery deadline, and only if nothing was submitted.",
  },
  {
    question: "What does the dispute resolver do?",
    answer: "Release and refund stop. The named resolver pays one side, or splits the amount.",
  },
  {
    question: "Does RELAY guarantee the work or a refund?",
    answer: "No. The contract enforces its rules. It does not judge the work.",
  },
  {
    question: "Which wallets and network does this use?",
    answer: "An injected wallet on Mezo Testnet, chain 31611. Gas is BTC. Mainnet is off.",
  },
  {
    question: "What fees are there?",
    answer: "No protocol fee. Your wallet shows the BTC network fee. Testnet MUSD is borrowed, not from the faucet.",
  },
];

export const FEATURE_CARDS = [
  {
    label: "Buyers",
    tone: "meadow" as const,
    mark: "lock" as const,
    copy: "Read the terms before any MUSD moves.",
  },
  {
    label: "Sellers",
    tone: "brand" as const,
    mark: "planet" as const,
    copy: "One checkout link. The buyer funds this agreement.",
  },
  {
    label: "Evidence",
    tone: "meadow" as const,
    mark: "hash" as const,
    copy: "A note and link, stored as a hash.",
  },
  {
    label: "Refunds",
    tone: "brand" as const,
    mark: "clock" as const,
    copy: "Missed delivery lets the buyer refund.",
  },
  {
    label: "Disputes",
    tone: "meadow" as const,
    mark: "scale" as const,
    copy: "Either party can dispute. The resolver settles it.",
  },
];

export const HOW_STEPS = [
  { title: "Agree", copy: "Amount, deadlines, review window, and resolver." },
  { title: "Fund", copy: "Buyer approves MUSD if needed, then deposits it." },
  { title: "Deliver", copy: "Seller submits a note and optional link." },
  { title: "Release", copy: "Buyer pays, disputes, or the deadline settles it." },
];
