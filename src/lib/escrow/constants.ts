/** Keep these aligned with RelayEscrow.sol. Contract tests assert the same numbers. */
export const MIN_REVIEW_PERIOD = 15 * 60;
export const MAX_REVIEW_PERIOD = 30 * 24 * 60 * 60;
export const MIN_DELIVERY_GAP = 60 * 60;
export const MAX_HORIZON = 365 * 24 * 60 * 60;
export const MAX_METADATA_BYTES = 2048;
export const MAX_EVIDENCE_BYTES = 800;
export const MAX_REASON_BYTES = 280;
export const MUSD_DECIMALS = 18;

export const REVIEW_PRESETS = [
  { id: "15m", label: "15 minutes", seconds: 15 * 60, hint: "Short enough for a testnet trial" },
  { id: "1h", label: "1 hour", seconds: 60 * 60, hint: "A brief review window" },
  { id: "24h", label: "24 hours", seconds: 24 * 60 * 60, hint: "One day to review delivery" },
  { id: "48h", label: "48 hours", seconds: 48 * 60 * 60, hint: "Default for most agreements" },
  { id: "72h", label: "72 hours", seconds: 72 * 60 * 60, hint: "Three days to review delivery" },
] as const;

export const STATE_LABELS = {
  Created: "Awaiting funding",
  Funded: "Funds secured",
  Delivered: "Review required",
  Released: "Paid to seller",
  Refunded: "Refunded to buyer",
  Disputed: "Disputed",
  Cancelled: "Cancelled",
  Split: "Split settlement",
} as const;

export const AUTO_RELEASE_DISCLOSURE =
  "No action before the review ends, and payment can finalize to the seller.";

export const RESOLVER_DISCLOSURE =
  "In a dispute, this resolver can pay the seller, refund the buyer, or split the amount.";

export const EVIDENCE_DISCLOSURE =
  "The hash records this note and URL. It does not prove the work.";

export const FUNDS_DISCLOSURE =
  "The escrow contract holds the MUSD.";

export const NO_FEE_DISCLOSURE =
  "No protocol fee. Your wallet shows the BTC network fee.";
