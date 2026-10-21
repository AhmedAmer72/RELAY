import { getAddress, isAddress, type Address, type Hex } from "viem";
import { verifyEvidence, verifyMetadata } from "@/lib/metadata/canonical";
import { ESCROW_STATES, type EscrowModel, type EscrowState } from "@/lib/escrow/types";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

type RawEscrow = {
  seller: string;
  buyer: string;
  resolver: string;
  amount: bigint;
  createdAt: bigint | number;
  fundingDeadline: bigint | number;
  deliveryDeadline: bigint | number;
  reviewDeadline: bigint | number;
  reviewPeriod: bigint | number;
  state: number | bigint;
  termsHash: Hex;
  metadataHash: Hex;
  evidenceHash: Hex;
  metadata: string;
  evidence: string;
};

export function coerceRawEscrow(data: unknown): RawEscrow {
  if (Array.isArray(data)) {
    const [seller, buyer, resolver, amount, createdAt, fundingDeadline, deliveryDeadline, reviewDeadline, reviewPeriod, state, termsHash, metadataHash, evidenceHash, metadata, evidence] = data;
    return { seller, buyer, resolver, amount, createdAt, fundingDeadline, deliveryDeadline, reviewDeadline, reviewPeriod, state, termsHash, metadataHash, evidenceHash, metadata, evidence };
  }
  return data as RawEscrow;
}

export function parseEscrow(id: bigint, raw: RawEscrow): EscrowModel {
  const stateIndex = Number(raw.state);
  const state = ESCROW_STATES[stateIndex] ?? "Created";
  const metadataCheck = verifyMetadata(raw.metadata, raw.metadataHash, raw.termsHash);
  const evidenceCheck = verifyEvidence(raw.evidence, raw.evidenceHash);
  return {
    id,
    seller: asAddress(raw.seller),
    buyer: asAddress(raw.buyer),
    resolver: asAddress(raw.resolver),
    amount: BigInt(raw.amount),
    createdAt: Number(raw.createdAt),
    fundingDeadline: Number(raw.fundingDeadline),
    deliveryDeadline: Number(raw.deliveryDeadline),
    reviewDeadline: Number(raw.reviewDeadline),
    reviewPeriod: Number(raw.reviewPeriod),
    state: state as EscrowState,
    termsHash: raw.termsHash,
    metadataHash: raw.metadataHash,
    evidenceHash: raw.evidenceHash || ZERO_HASH,
    metadataRaw: raw.metadata,
    evidenceRaw: raw.evidence,
    metadata: metadataCheck.metadata,
    evidence: evidenceCheck.evidence,
    metadataVerified: metadataCheck.verified,
    metadataProblems: metadataCheck.problems,
    evidenceVerified: evidenceCheck.verified,
    evidenceProblems: evidenceCheck.problems,
  };
}

function asAddress(value: string): Address {
  if (!isAddress(value)) throw new Error("Escrow contained an invalid address.");
  return getAddress(value);
}
