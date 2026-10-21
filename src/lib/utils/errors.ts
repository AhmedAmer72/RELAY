const CONTRACT_ERRORS: Record<string, string> = {
  ZeroAmount: "Enter an amount greater than zero.",
  InvalidAddress: "One of the addresses is missing or has no contract code.",
  BuyerIsSeller: "The buyer and seller must be different wallets.",
  ResolverIsParty: "The resolver must be different from the buyer and the seller.",
  InvalidDeadline: "Those deadlines are outside the limits this contract accepts.",
  InvalidReviewPeriod: "Choose a review window between 15 minutes and 30 days.",
  InvalidMetadata: "The agreement text is empty or too long to store on-chain.",
  EscrowNotFound: "That agreement was not found on the escrow contract.",
  InvalidState: "The escrow state changed. Please refresh before continuing.",
  NotBuyer: "Only the buyer recorded on this agreement can do that.",
  NotSeller: "Only the seller recorded on this agreement can do that.",
  NotParty: "Only the buyer or seller can do that.",
  NotResolver: "Only the resolver named in this agreement can settle it.",
  FundingClosed: "This invoice can no longer be funded.",
  DeliveryWindowClosed: "That delivery or refund action does not match the current deadline.",
  ReviewWindowOpen: "The review window has not ended yet.",
  ReviewWindowClosed: "The review window has ended, so that action is no longer available.",
  ZeroHash: "A required hash was empty.",
  EvidenceTooLarge: "The evidence record is too long. Shorten the note or URL.",
  UnexpectedTokenAmount: "The token did not deliver the exact escrow amount. The payment was not accepted.",
  ReasonInvalid: "Enter a dispute reason of 280 characters or fewer.",
  HashMismatch: "The submitted text did not match its hash. Refresh and try again.",
  SplitAmount: "A split must give some MUSD to each party. Use the full release or full refund for a one-sided settlement.",
  ReentrancyGuardReentrantCall: "The token tried to reenter the escrow. The transaction was rejected.",
};

export type ExplainedError = { title: string; detail?: string };

export function explainError(error: unknown): ExplainedError {
  const fragments = collect(error);
  const joined = fragments.join(" ");
  if (isUserRejected(fragments)) {
    return { title: "You cancelled the wallet request. No change was confirmed on-chain." };
  }
  for (const name of Object.keys(CONTRACT_ERRORS)) {
    if (joined.includes(name)) return { title: CONTRACT_ERRORS[name], detail: sanitize(joined) };
  }
  if (/insufficient funds/i.test(joined)) {
    return { title: "Your wallet may not have enough BTC for network gas.", detail: sanitize(joined) };
  }
  if (/transfer amount exceeds balance/i.test(joined)) {
    return { title: "You do not have enough MUSD to fund this invoice.", detail: sanitize(joined) };
  }
  if (/timed out|timeout/i.test(joined)) {
    return { title: "The network did not confirm the result yet. Check the transaction status before trying again." };
  }
  return {
    title: "The transaction failed on-chain. No successful state change has been confirmed.",
    detail: sanitize(joined),
  };
}

export function isUserRejected(fragments: string[]) {
  return fragments.some((item) => /user rejected|user denied|rejected the request|4001/i.test(item));
}

function collect(error: unknown, depth = 0): string[] {
  if (!error || depth > 5) return [];
  if (typeof error === "string") return [error];
  if (error instanceof Error) {
    const extra = error as Error & { shortMessage?: string; cause?: unknown; name?: string; code?: number };
    return [extra.name, extra.shortMessage, extra.message, String(extra.code ?? ""), ...collect(extra.cause, depth + 1)].filter(Boolean) as string[];
  }
  return [String(error)];
}

function sanitize(value: string) {
  return value.replace(/0x[a-fA-F0-9]{64}/g, "0x…").replace(/\s+/g, " ").trim().slice(0, 240);
}
