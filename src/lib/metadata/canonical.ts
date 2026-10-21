import { keccak256, stringToBytes, type Hex } from "viem";

export type MilestonePlan = {
  id: string;
  index: number;
  count: number;
  label: string;
};

export type AgreementMetadata = {
  v: 1;
  title: string;
  description: string;
  terms: string;
  termsHash: Hex;
  plan?: MilestonePlan;
};

export type EvidenceMetadata = {
  v: 1;
  note: string;
  url: string;
};

export function hashUtf8(value: string): Hex {
  return keccak256(stringToBytes(value));
}

export function utf8Size(value: string) {
  return new TextEncoder().encode(value).length;
}

export function buildMetadata(input: { title: string; description: string; terms: string; plan?: MilestonePlan }) {
  const termsHash = hashUtf8(input.terms);
  const metadata: AgreementMetadata = {
    v: 1,
    title: input.title,
    description: input.description,
    terms: input.terms,
    termsHash,
  };
  if (input.plan) metadata.plan = input.plan;
  const json = JSON.stringify(metadata);
  return { json, termsHash, metadataHash: hashUtf8(json), metadata };
}

export function buildEvidence(input: { note: string; url: string }) {
  const evidence: EvidenceMetadata = { v: 1, note: input.note, url: input.url };
  const json = JSON.stringify(evidence);
  return { json, evidenceHash: hashUtf8(json), evidence };
}

export function buildReason(reason: string) {
  return { reason, reasonHash: hashUtf8(reason) };
}

export type Verification = {
  verified: boolean;
  problems: string[];
  metadata: AgreementMetadata | null;
};

export function verifyMetadata(raw: string, metadataHash: Hex, termsHash: Hex): Verification {
  const problems: string[] = [];
  if (!raw) problems.push("The agreement metadata is empty.");
  if (hashUtf8(raw) !== metadataHash) {
    problems.push("Agreement details could not be verified against the on-chain hash.");
  }
  let metadata: AgreementMetadata | null = null;
  try {
    const parsed = JSON.parse(raw) as Partial<AgreementMetadata>;
    if (parsed.v !== 1 || typeof parsed.title !== "string" || typeof parsed.description !== "string" || typeof parsed.terms !== "string" || typeof parsed.termsHash !== "string") {
      problems.push("The agreement metadata does not match the expected format.");
    } else {
      metadata = parsed as AgreementMetadata;
      if (metadata.termsHash !== termsHash) problems.push("The stored terms hash does not match the metadata.");
      if (hashUtf8(metadata.terms) !== metadata.termsHash) problems.push("The terms text does not match its recorded hash.");
      if (metadata.plan !== undefined) {
        const plan = metadata.plan;
        if (!plan || typeof plan.id !== "string" || typeof plan.label !== "string" || !Number.isInteger(plan.index) || !Number.isInteger(plan.count) || plan.index < 1 || plan.count < 2 || plan.index > plan.count) {
          problems.push("The milestone plan could not be read.");
        }
      }
    }
  } catch {
    problems.push("The agreement metadata could not be read.");
  }
  return { verified: problems.length === 0, problems, metadata };
}

export function verifyEvidence(raw: string, evidenceHash: Hex): { verified: boolean; problems: string[]; evidence: EvidenceMetadata | null } {
  if (!raw || evidenceHash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return { verified: false, problems: [], evidence: null };
  }
  const problems: string[] = [];
  if (hashUtf8(raw) !== evidenceHash) problems.push("Delivery evidence could not be verified against the on-chain hash.");
  try {
    const parsed = JSON.parse(raw) as Partial<EvidenceMetadata>;
    if (parsed.v !== 1 || typeof parsed.note !== "string" || typeof parsed.url !== "string") {
      problems.push("The evidence record does not match the expected format.");
      return { verified: false, problems, evidence: null };
    }
    return { verified: problems.length === 0, problems, evidence: parsed as EvidenceMetadata };
  } catch {
    problems.push("The evidence record could not be read.");
    return { verified: false, problems, evidence: null };
  }
}

export function safeHttpsUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
