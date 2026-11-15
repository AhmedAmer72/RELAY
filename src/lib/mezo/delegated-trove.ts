/**
 * Mezo's BorrowerOperationsSignatures.withdrawMUSDWithSignature includes an
 * independent recipient in the signed struct. The contract does not require
 * that recipient to be the borrower. RELAY does not ask a wallet to sign that
 * payload, and it is not connected to agent budgets.
 */
export const DELEGATED_TROVE = {
  status: "refused" as const,
  contract: "BorrowerOperationsSignatures",
  source: "https://github.com/mezo-org/musd/blob/main/solidity/contracts/BorrowerOperationsSignatures.sol",
  reason: "withdrawMUSDWithSignature can name a recipient other than the borrower. A deadline and nonce are present, but the recipient is not fixed to the signer.",
};
