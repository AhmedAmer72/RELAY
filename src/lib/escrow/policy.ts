import { getAddress, type Address } from "viem";
import { AUTO_RELEASE_DISCLOSURE, STATE_LABELS } from "@/lib/escrow/constants";
import { isZeroAddress, sameAddress } from "@/lib/escrow/format";
import type { ActionAvailability, EscrowModel, PanelModel } from "@/lib/escrow/types";

export type PolicyInput = {
  escrow: EscrowModel;
  wallet?: Address;
  now?: number;
  chainMatches: boolean;
  configured: boolean;
  networkName: string;
  hasContractCode?: boolean;
  decimals?: number;
  symbol?: string;
  balance?: bigint;
  allowance?: bigint;
  nativeBalance?: bigint;
  partialSettlement?: boolean;
  agentAllowance?: bigint;
};

function action(partial: ActionAvailability): ActionAvailability {
  return partial;
}

export function requiresUserAction(escrow: EscrowModel, wallet: Address | undefined, now: number | undefined) {
  if (!wallet || now === undefined) return false;
  const buyer = sameAddress(wallet, escrow.buyer);
  const seller = sameAddress(wallet, escrow.seller);
  const resolver = sameAddress(wallet, escrow.resolver);
  if (escrow.state === "Created" && buyer && now <= escrow.fundingDeadline) return true;
  if (escrow.state === "Created" && isZeroAddress(escrow.buyer) && !seller && !resolver && now <= escrow.fundingDeadline) return true;
  if (escrow.state === "Funded" && seller && now <= escrow.deliveryDeadline) return true;
  if (escrow.state === "Funded" && buyer && now > escrow.deliveryDeadline) return true;
  if (escrow.state === "Delivered" && buyer && now <= escrow.reviewDeadline) return true;
  if (escrow.state === "Delivered" && (buyer || seller) && now > escrow.reviewDeadline) return true;
  if (escrow.state === "Disputed" && resolver) return true;
  return false;
}

export function evaluateEscrow(input: PolicyInput): PanelModel {
  const notices: string[] = [];
  const secondary: ActionAvailability[] = [];
  let primary: ActionAvailability | undefined;
  const { escrow, wallet, now } = input;
  const timeKnown = typeof now === "number";

  if (!input.configured) {
    return {
      notices: ["The escrow contract address is not configured. On-chain actions are disabled until a deployed address is set."],
      secondary: [],
    };
  }
  if (input.hasContractCode === false) {
    return {
      notices: ["No contract code was found at the configured escrow address on this network. Actions are disabled."],
      secondary: [],
    };
  }

  if (!escrow.metadataVerified) {
    notices.push(escrow.metadataProblems[0] ?? "Agreement details could not be verified against the on-chain hash.");
  }
  if (escrow.evidenceRaw && !escrow.evidenceVerified) {
    notices.push(escrow.evidenceProblems[0] ?? "Delivery evidence could not be verified against the on-chain hash.");
  }

  if (wallet && !input.chainMatches) {
    notices.push("Your wallet is connected to an unsupported network.");
    return {
      notices,
      primary: action({
        id: "switch-network",
        label: `Switch to ${input.networkName}`,
        description: "RELAY will not ask you to sign on a different network.",
        tone: "primary",
      }),
      secondary,
    };
  }

  if (wallet && input.nativeBalance === 0n && escrow.state !== "Released" && escrow.state !== "Refunded" && escrow.state !== "Cancelled" && escrow.state !== "Split") {
    notices.push("Your wallet may not have enough BTC for network gas.");
  }

  const tokenReady = input.decimals === 18 && input.symbol === "MUSD";
  const tokenKnown = input.decimals !== undefined && input.symbol !== undefined;
  if (tokenKnown && input.decimals !== 18) notices.push("The configured token did not report 18 decimals. Funding is disabled.");
  if (tokenKnown && input.symbol !== "MUSD") notices.push(`The configured token symbol is ${input.symbol}, not MUSD. Funding is disabled.`);

  const seller = sameAddress(wallet, escrow.seller);
  const buyer = sameAddress(wallet, escrow.buyer);
  const resolver = sameAddress(wallet, escrow.resolver);
  const open = isZeroAddress(escrow.buyer);
  const eligibleFunder = Boolean(wallet) && (open ? !seller && !resolver : buyer);

  const setPrimary = (value: ActionAvailability) => {
    primary = value;
  };

  if (!wallet && escrow.state !== "Released" && escrow.state !== "Refunded" && escrow.state !== "Cancelled" && escrow.state !== "Split") {
    secondary.push(action({
      id: "connect",
      label: escrow.state === "Created" ? "Connect wallet to fund" : "Connect wallet",
        description: "Read first. A wallet is only needed to sign.",
      tone: "primary",
    }));
  }

  if (escrow.state === "Created") {
    const windowOpen = timeKnown && now <= escrow.fundingDeadline;
    const expired = timeKnown && now > escrow.fundingDeadline;
    if (!timeKnown) notices.push("Waiting for the network time.");
    if (expired) notices.push("This invoice can no longer be funded.");
    const agentBudget = input.agentAllowance;
    const agentCandidate = Boolean(wallet) && !open && !buyer && !seller && !resolver;
    if (wallet && !open && !buyer && !(agentCandidate && agentBudget !== undefined && agentBudget > 0n)) {
      notices.push("This checkout is restricted to another buyer.");
    }
    if (wallet && open && (seller || resolver)) notices.push("Seller and resolver cannot fund an open checkout.");
    if (!escrow.metadataVerified) notices.push("Funding stays off until the agreement hash matches.");

    if (wallet && (seller || expired) && timeKnown) {
      secondary.push(action({
        id: "cancel",
        label: "Cancel unfunded checkout",
        description: "Permanent. No tokens move.",
        tone: "secondary",
      }));
    }

    if (wallet && eligibleFunder && windowOpen && escrow.metadataVerified && tokenReady) {
      if (input.balance === undefined || input.allowance === undefined) {
        notices.push("Checking your MUSD balance and approval.");
      } else if (input.balance < escrow.amount) {
        notices.push("You do not have enough MUSD to fund this invoice.");
      } else if (input.allowance < escrow.amount) {
        setPrimary(action({
          id: "approve",
          label: "Approve MUSD",
          description: "Allows the exact amount. Does not send it.",
          tone: "primary",
        }));
      } else {
        setPrimary(action({
          id: "fund",
          label: "Fund escrow",
          description: "Sends the MUSD into escrow.",
          tone: "primary",
        }));
      }
    } else if (wallet && eligibleFunder && windowOpen && escrow.metadataVerified && !tokenKnown) {
      notices.push("Checking the MUSD token on this network.");
    }

    if (agentCandidate && windowOpen && escrow.metadataVerified && tokenReady && agentBudget !== undefined && agentBudget > 0n) {
      if (agentBudget < escrow.amount) {
        notices.push("Your agent budget does not cover this invoice.");
      } else if (!primary) {
        setPrimary(action({
          id: "fund-as-agent",
          label: "Fund with agent budget",
          description: "Pulls the buyer's MUSD. You do not become the buyer.",
          tone: "primary",
        }));
      }
    }
  }

  if (escrow.state === "Funded") {
    const deliveryOpen = timeKnown && now <= escrow.deliveryDeadline;
    const deliveryMissed = timeKnown && now > escrow.deliveryDeadline;
    if (!timeKnown) notices.push("Waiting for the network time.");
    if (seller && deliveryOpen) {
      setPrimary(action({
        id: "submit-delivery",
        label: "Submit delivery evidence",
        description: EVIDENCE_HINT,
        tone: "primary",
      }));
    }
    if (buyer && deliveryMissed) {
      setPrimary(action({
        id: "refund",
        label: "Refund after missed deadline",
        description: "Deadline passed with no delivery. Returns the MUSD to the buyer.",
        tone: "primary",
      }));
    } else if (buyer && deliveryOpen) {
      notices.push("Refund opens only after a missed delivery deadline.");
    }
    if (seller && deliveryMissed) notices.push("Delivery window closed.");
  }

  if (escrow.state === "Delivered") {
    const reviewOpen = timeKnown && now <= escrow.reviewDeadline;
    const reviewElapsed = timeKnown && now > escrow.reviewDeadline;
    if (!timeKnown) notices.push("Waiting for the network time.");
    notices.push(AUTO_RELEASE_DISCLOSURE);
    if (buyer && reviewOpen) {
      setPrimary(action({
        id: "release",
        label: "Approve delivery and release funds",
        description: "Pays the seller. Cannot be undone.",
        tone: "primary",
      }));
      secondary.push(action({
        id: "dispute",
        label: "Raise a dispute",
        description: "Stops release and refund. The resolver settles it.",
        tone: "danger",
      }));
    }
    if (seller && reviewOpen) {
      secondary.push(action({
        id: "dispute",
        label: "Raise a dispute",
        description: "Stops release. The resolver settles it.",
        tone: "danger",
      }));
      if (!buyer) notices.push("The buyer can release during review.");
    }
    if (reviewElapsed && wallet) {
      setPrimary(action({
        id: "finalize-review",
        label: "Finalize payment to seller",
        description: "Review ended. Pays the seller. Caller gets nothing.",
        tone: "primary",
      }));
    }
  }

  if (escrow.state === "Disputed") {
    notices.push("Release and refund are paused. Only the resolver can settle.");
    if (resolver) {
      setPrimary(action({
        id: "resolve-seller",
        label: "Release full amount to seller",
        description: "Full amount to the seller.",
        tone: "primary",
      }));
      secondary.push(action({
        id: "resolve-buyer",
        label: "Refund full amount to buyer",
        description: "Full amount back to the buyer.",
        tone: "danger",
      }));
      if (input.partialSettlement) {
        secondary.push(action({
          id: "resolve-split",
          label: "Split the amount",
          description: "Part to the seller, rest to the buyer.",
          tone: "secondary",
        }));
      }
    }
  }

  if (escrow.state === "Released") notices.push("Settled. Paid to the seller.");
  if (escrow.state === "Refunded") notices.push("Settled. Refunded to the buyer.");
  if (escrow.state === "Cancelled") notices.push("Cancelled. Can no longer be funded.");
  if (escrow.state === "Split") notices.push("Settled by a split.");

  if (!wallet && secondary.some((item) => item.id === "connect") && !primary) {
    primary = secondary.find((item) => item.id === "connect");
    return { notices, primary, secondary: secondary.filter((item) => item.id !== "connect") };
  }

  return { notices, primary, secondary };
}

const EVIDENCE_HINT = "A short note and an optional link. Stored as a hash.";

export function stateLabel(state: EscrowModel["state"]) {
  return STATE_LABELS[state];
}

export function checksum(address: string) {
  return getAddress(address);
}
