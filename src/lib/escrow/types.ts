import type { Address, Hex } from "viem";
import type { AgreementMetadata, EvidenceMetadata } from "@/lib/metadata/canonical";

export const ESCROW_STATES = ["Created", "Funded", "Delivered", "Released", "Refunded", "Disputed", "Cancelled", "Split"] as const;

export type EscrowState = (typeof ESCROW_STATES)[number];

export type EscrowModel = {
  id: bigint;
  seller: Address;
  buyer: Address;
  resolver: Address;
  amount: bigint;
  createdAt: number;
  fundingDeadline: number;
  deliveryDeadline: number;
  reviewDeadline: number;
  reviewPeriod: number;
  state: EscrowState;
  termsHash: Hex;
  metadataHash: Hex;
  evidenceHash: Hex;
  metadataRaw: string;
  evidenceRaw: string;
  metadata: AgreementMetadata | null;
  evidence: EvidenceMetadata | null;
  metadataVerified: boolean;
  metadataProblems: string[];
  evidenceVerified: boolean;
  evidenceProblems: string[];
};

export type ActionId =
  | "connect"
  | "switch-network"
  | "approve"
  | "fund"
  | "fund-as-agent"
  | "cancel"
  | "submit-delivery"
  | "release"
  | "finalize-review"
  | "refund"
  | "dispute"
  | "resolve-seller"
  | "resolve-buyer"
  | "resolve-split";

export type ActionAvailability = {
  id: ActionId;
  label: string;
  description: string;
  tone: "primary" | "secondary" | "danger";
};

export type PanelModel = {
  notices: string[];
  primary?: ActionAvailability;
  secondary: ActionAvailability[];
};

export type TxPhase =
  | { phase: "idle" }
  | { phase: "preparing"; action: string }
  | { phase: "awaiting_wallet"; action: string }
  | { phase: "submitted"; action: string; hash: Hex }
  | { phase: "confirming"; action: string; hash: Hex }
  | { phase: "confirmed"; action: string; hash: Hex }
  | { phase: "rejected"; action: string; message: string }
  | { phase: "reverted"; action: string; message: string; hash?: Hex }
  | { phase: "unknown"; action: string; message: string; hash?: Hex };
