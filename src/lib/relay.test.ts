import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { evaluateEscrow, requiresUserAction } from "@/lib/escrow/policy";
import { formatMusd, parseMusdInput } from "@/lib/escrow/format";
import type { EscrowModel } from "@/lib/escrow/types";
import { buildEvidence, buildMetadata, hashUtf8, verifyMetadata } from "@/lib/metadata/canonical";
import { explainError } from "@/lib/utils/errors";
import { validateCreateDraft, type CreateDraft } from "@/lib/validation/create";
import { validateEvidence, validateReason } from "@/lib/validation/actions";

const seller = getAddress("0x0000000000000000000000000000000000000001");
const buyer = getAddress("0x0000000000000000000000000000000000000002");
const resolver = getAddress("0x0000000000000000000000000000000000000003");
const outsider = getAddress("0x0000000000000000000000000000000000000004");
const now = 1_700_000_000;

function model(overrides: Partial<EscrowModel> = {}): EscrowModel {
  const meta = buildMetadata({
    title: "Logo pack",
    description: "A complete logo pack for the client.",
    terms: "Deliver SVG and PNG files.",
  });
  return {
    id: 1n,
    seller,
    buyer,
    resolver,
    amount: 50n * 10n ** 18n,
    createdAt: now,
    fundingDeadline: now + 86_400,
    deliveryDeadline: now + 172_800,
    reviewDeadline: 0,
    reviewPeriod: 3_600,
    state: "Created",
    termsHash: meta.termsHash,
    metadataHash: meta.metadataHash,
    evidenceHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    metadataRaw: meta.json,
    evidenceRaw: "",
    metadata: meta.metadata,
    evidence: null,
    metadataVerified: true,
    metadataProblems: [],
    evidenceVerified: false,
    evidenceProblems: [],
    ...overrides,
  };
}

const ready = {
  chainMatches: true,
  configured: true,
  networkName: "Mezo Testnet",
  hasContractCode: true,
  decimals: 18,
  symbol: "MUSD",
  balance: 100n * 10n ** 18n,
  allowance: 100n * 10n ** 18n,
  nativeBalance: 1n,
  now,
};

describe("escrow policy", () => {
  it("asks a disconnected visitor to connect before funding", () => {
    const panel = evaluateEscrow({ escrow: model(), ...ready, wallet: undefined });
    expect(panel.primary?.id).toBe("connect");
    expect(panel.primary?.label).toMatch(/Connect wallet/);
  });

  it("offers approval before funding and funding only when allowance is enough", () => {
    const needsApproval = evaluateEscrow({ escrow: model(), ...ready, wallet: buyer, allowance: 0n });
    expect(needsApproval.primary?.id).toBe("approve");
    const funded = evaluateEscrow({ escrow: model(), ...ready, wallet: buyer });
    expect(funded.primary?.id).toBe("fund");
  });

  it("lets an authorized agent fund a named buyer without becoming the buyer", () => {
    const covered = evaluateEscrow({ escrow: model(), ...ready, wallet: outsider, agentAllowance: 50n * 10n ** 18n });
    expect(covered.primary?.id).toBe("fund-as-agent");
    expect(covered.notices.join(" ")).not.toMatch(/restricted to another buyer/);
    const short = evaluateEscrow({ escrow: model(), ...ready, wallet: outsider, agentAllowance: 1n });
    expect(short.primary?.id).not.toBe("fund-as-agent");
    expect(short.notices.join(" ")).toMatch(/does not cover/);
  });

  it("blocks funding when balance, buyer, metadata, or token checks fail", () => {
    const poor = evaluateEscrow({ escrow: model(), ...ready, wallet: buyer, balance: 1n });
    expect(poor.primary?.id).not.toBe("fund");
    expect(poor.notices.join(" ")).toMatch(/enough MUSD/);
    const wrong = evaluateEscrow({ escrow: model(), ...ready, wallet: outsider });
    expect(wrong.notices.join(" ")).toMatch(/restricted to another buyer/);
    const broken = evaluateEscrow({ escrow: model({ metadataVerified: false, metadataProblems: ["Agreement details could not be verified against the on-chain hash."] }), ...ready, wallet: buyer });
    expect(broken.primary?.id).not.toBe("fund");
    const badToken = evaluateEscrow({ escrow: model(), ...ready, wallet: buyer, decimals: 6, symbol: "USDC" });
    expect(badToken.primary?.id).not.toBe("fund");
    expect(badToken.notices.join(" ")).toMatch(/18 decimals/);
  });

  it("switches network before any write", () => {
    const panel = evaluateEscrow({ escrow: model(), ...ready, wallet: buyer, chainMatches: false });
    expect(panel.primary?.id).toBe("switch-network");
    expect(panel.notices.join(" ")).toMatch(/unsupported network/);
  });

  it("lets the seller cancel and submit delivery, but not release their own funds", () => {
    const created = evaluateEscrow({ escrow: model(), ...ready, wallet: seller });
    expect(created.secondary.map((action) => action.id)).toContain("cancel");
    expect(created.primary?.id).not.toBe("release");
    const delivering = evaluateEscrow({ escrow: model({ state: "Funded" }), ...ready, wallet: seller });
    expect(delivering.primary?.id).toBe("submit-delivery");
    const reviewing = evaluateEscrow({ escrow: model({ state: "Delivered", reviewDeadline: now + 10 }), ...ready, wallet: seller });
    expect(reviewing.primary?.id).not.toBe("release");
    expect(reviewing.secondary.map((action) => action.id)).toContain("dispute");
  });

  it("follows the delivery and review deadline boundaries", () => {
    const escrow = model({ state: "Funded" });
    expect(evaluateEscrow({ escrow, ...ready, wallet: buyer, now: escrow.deliveryDeadline }).primary?.id).not.toBe("refund");
    expect(evaluateEscrow({ escrow, ...ready, wallet: buyer, now: escrow.deliveryDeadline + 1 }).primary?.id).toBe("refund");
    const delivered = model({ state: "Delivered", reviewDeadline: now + 100 });
    const atDeadline = evaluateEscrow({ escrow: delivered, ...ready, wallet: buyer, now: delivered.reviewDeadline });
    expect(atDeadline.primary?.id).toBe("release");
    expect(atDeadline.secondary.map((action) => action.id)).toContain("dispute");
    const after = evaluateEscrow({ escrow: delivered, ...ready, wallet: outsider, now: delivered.reviewDeadline + 1 });
    expect(after.primary?.id).toBe("finalize-review");
    expect(after.secondary.map((action) => action.id)).not.toContain("dispute");
  });

  it("limits dispute settlement to the stored resolver", () => {
    const escrow = model({ state: "Disputed" });
    const resolverPanel = evaluateEscrow({ escrow, ...ready, wallet: resolver });
    expect(resolverPanel.primary?.id).toBe("resolve-seller");
    expect(resolverPanel.secondary.map((action) => action.id)).toContain("resolve-buyer");
    const buyerPanel = evaluateEscrow({ escrow, ...ready, wallet: buyer });
    expect(buyerPanel.primary?.id).not.toBe("resolve-seller");
    expect(buyerPanel.notices.join(" ")).toMatch(/Only the resolver/);
  });

  it("does not offer writes from terminal states", () => {
    for (const state of ["Released", "Refunded", "Cancelled"] as const) {
      const panel = evaluateEscrow({ escrow: model({ state }), ...ready, wallet: buyer });
      expect(panel.primary).toBeUndefined();
    }
  });

  it("flags the wallet that must act", () => {
    expect(requiresUserAction(model(), buyer, now)).toBe(true);
    expect(requiresUserAction(model(), buyer, model().fundingDeadline)).toBe(true);
    expect(requiresUserAction(model(), buyer, model().fundingDeadline + 1)).toBe(false);
    expect(requiresUserAction(model({ state: "Funded" }), seller, model().deliveryDeadline)).toBe(true);
    expect(requiresUserAction(model({ state: "Funded" }), buyer, model().deliveryDeadline)).toBe(false);
    expect(requiresUserAction(model({ state: "Funded" }), buyer, model().deliveryDeadline + 1)).toBe(true);
    expect(requiresUserAction(model({ state: "Disputed" }), resolver, now)).toBe(true);
    expect(requiresUserAction(model({ state: "Disputed" }), buyer, now)).toBe(false);
  });

  it("disables actions when the contract is not configured", () => {
    const panel = evaluateEscrow({ escrow: model(), ...ready, configured: false, wallet: buyer });
    expect(panel.primary).toBeUndefined();
    expect(panel.notices[0]).toMatch(/not configured/);
  });
});

describe("amounts and metadata", () => {
  it("parses MUSD without floating-point math", () => {
    expect(parseMusdInput("1.5")).toEqual({ ok: true, amount: 1_500_000_000_000_000_000n });
    expect(parseMusdInput("0")).toMatchObject({ ok: false });
    expect(parseMusdInput("1.1234567890123456789")).toMatchObject({ ok: false });
    expect(formatMusd(1_500_000_000_000_000_000n)).toBe("1.50");
    expect(formatMusd(1_230_000_000_000_000_000n)).toBe("1.23");
  });

  it("hashes canonical metadata the same way twice and rejects a mismatch", () => {
    const first = buildMetadata({ title: "Logo pack", description: "A complete logo pack for the client.", terms: "Deliver SVG and PNG files." });
    const second = buildMetadata({ title: "Logo pack", description: "A complete logo pack for the client.", terms: "Deliver SVG and PNG files." });
    expect(first.metadataHash).toBe(second.metadataHash);
    expect(verifyMetadata(first.json, first.metadataHash, first.termsHash).verified).toBe(true);
    expect(verifyMetadata(first.json, hashUtf8("other"), first.termsHash).verified).toBe(false);
    const evidence = buildEvidence({ note: "Files sent", url: "https://example.com/a" });
    expect(evidence.evidenceHash).toBe(hashUtf8(evidence.json));
  });
});

describe("form validation", () => {
  const base = (): CreateDraft => ({
    title: "Logo pack",
    description: "A complete logo pack for the client.",
    terms: "Deliver SVG and PNG files.",
    amount: "25",
    buyerMode: "specific",
    buyer,
    resolver,
    fundingDeadline: now + 86_400,
    deliveryDeadline: now + 172_800,
    reviewPeriod: 3_600,
    acknowledged: true,
  });

  it("accepts a complete draft and rejects unsafe parties or deadlines", () => {
    expect(validateCreateDraft(base(), seller, now).valid).toBe(true);
    expect(validateCreateDraft({ ...base(), amount: "0" }, seller, now).errors.amount).toBeTruthy();
    expect(validateCreateDraft({ ...base(), buyer: seller }, seller, now).errors.buyer).toMatch(/different wallet/);
    expect(validateCreateDraft({ ...base(), resolver: seller }, seller, now).errors.resolver).toMatch(/cannot be the seller/);
    expect(validateCreateDraft({ ...base(), resolver: buyer }, seller, now).errors.resolver).toMatch(/cannot be the buyer/);
    expect(validateCreateDraft({ ...base(), deliveryDeadline: (base().fundingDeadline ?? 0) + 60 }, seller, now).errors.deliveryDeadline).toMatch(/1 hour/);
    expect(validateCreateDraft({ ...base(), acknowledged: false }, seller, now).errors.acknowledged).toBeTruthy();
  });

  it("validates evidence URLs and public dispute reasons", () => {
    expect(validateEvidence("Files are ready", "https://example.com/delivery").valid).toBe(true);
    expect(validateEvidence("Files are ready", "http://example.com").valid).toBe(false);
    expect(validateEvidence("Files are ready", "javascript:alert(1)").valid).toBe(false);
    expect(validateReason("The archive is missing the source files.").ok).toBe(true);
    expect(validateReason("")).toMatchObject({ ok: false });
  });
});

describe("errors", () => {
  it("maps wallet rejection and contract errors without returning a stack", () => {
    const rejected = explainError(Object.assign(new Error("User rejected the request"), { code: 4001 }));
    expect(rejected.title).toMatch(/cancelled the wallet request/);
    const state = explainError(new Error("execution reverted with custom error InvalidState()"));
    expect(state.title).toMatch(/escrow state changed/i);
    expect(state.detail ?? "").not.toMatch(/at /);
  });
});
