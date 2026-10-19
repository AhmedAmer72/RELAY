import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { Contract, Signer } from "ethers";

const { ethers, network } = hre;

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;
const MIN_REVIEW = 15 * 60;
const MAX_REVIEW = 30 * DAY;
const MIN_GAP = HOUR;
const MAX_HORIZON = 365 * DAY;

async function receiptOf(tx: { wait: () => Promise<{ status: number | null } | null> }) {
  try {
    return await tx.wait();
  } catch (error) {
    const receipt = (error as { receipt?: { status: number | null } }).receipt;
    if (receipt) return receipt;
    throw error;
  }
}

const STATE = {
  Created: 0n,
  Funded: 1n,
  Delivered: 2n,
  Released: 3n,
  Refunded: 4n,
  Disputed: 5n,
  Cancelled: 6n,
  Split: 7n,
} as const;

function hashText(value: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

function buildMeta(title = "Brand system", description = "A logo and a one-page usage guide.", terms = "Deliver the logo pack and the guide.") {
  const termsHash = hashText(terms);
  const metadata = JSON.stringify({ v: 1, title, description, terms, termsHash });
  return { termsHash, metadata, metadataHash: hashText(metadata) };
}

function buildEvidence(note = "Logo pack sent", url = "https://example.com/delivery") {
  const evidence = JSON.stringify({ v: 1, note, url });
  return { evidence, evidenceHash: hashText(evidence) };
}

async function deployFixture() {
  const [seller, buyer, resolver, outsider, donor] = await ethers.getSigners();
  const musd = await ethers.deployContract("MockMUSD");
  await musd.waitForDeployment();
  const escrow = await ethers.deployContract("RelayEscrow", [await musd.getAddress()]);
  await escrow.waitForDeployment();
  const amount = ethers.parseEther("50");
  await musd.mint(buyer.address, ethers.parseEther("1000"));
  await musd.mint(outsider.address, ethers.parseEther("1000"));
  await musd.mint(seller.address, ethers.parseEther("1000"));
  return { seller, buyer, resolver, outsider, donor, musd, escrow, amount };
}

async function createAgreement(
  escrow: Contract,
  seller: Signer,
  resolver: Signer,
  buyer: string,
  amount: bigint,
  offsets?: { fundingIn?: number; deliveryAfterFunding?: number; review?: number },
) {
  const latest = BigInt(await time.latest());
  const fundingDeadline = latest + BigInt(offsets?.fundingIn ?? 2 * DAY);
  const deliveryDeadline = fundingDeadline + BigInt(offsets?.deliveryAfterFunding ?? 2 * DAY);
  const reviewPeriod = offsets?.review ?? HOUR;
  const meta = buildMeta();
  const tx = await escrow
    .connect(seller)
    .createEscrow(
      buyer,
      await resolver.getAddress(),
      amount,
      fundingDeadline,
      deliveryDeadline,
      reviewPeriod,
      meta.termsHash,
      meta.metadataHash,
      meta.metadata,
    );
  const receipt = await tx.wait();
  const parsed = receipt?.logs
    .map((log) => {
      try {
        return escrow.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "EscrowCreated");
  if (!parsed) throw new Error("EscrowCreated was not emitted");
  return {
    id: parsed.args.escrowId as bigint,
    fundingDeadline,
    deliveryDeadline,
    reviewPeriod,
    ...meta,
    receipt,
  };
}

async function fund(musd: Contract, escrow: Contract, buyer: Signer, id: bigint, amount: bigint) {
  await musd.connect(buyer).approve(await escrow.getAddress(), amount);
  return escrow.connect(buyer).fundEscrow(id);
}

describe("RelayEscrow", function () {
  it("exposes the documented policy constants", async function () {
    const { escrow } = await deployFixture();
    expect(await escrow.MIN_REVIEW_PERIOD()).to.equal(MIN_REVIEW);
    expect(await escrow.MAX_REVIEW_PERIOD()).to.equal(MAX_REVIEW);
    expect(await escrow.MIN_DELIVERY_GAP()).to.equal(MIN_GAP);
    expect(await escrow.MAX_HORIZON()).to.equal(MAX_HORIZON);
    expect(await escrow.MAX_METADATA_BYTES()).to.equal(2048);
    expect(await escrow.MAX_EVIDENCE_BYTES()).to.equal(800);
    expect(await escrow.MAX_REASON_BYTES()).to.equal(280);
  });

  it("creates a restricted escrow and stores the canonical metadata", async function () {
    const { escrow, seller, buyer, resolver, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    const stored = await escrow.getEscrow(created.id);

    expect(created.id).to.equal(1n);
    expect(await escrow.escrowCount()).to.equal(1n);
    expect(await escrow.nextEscrowId()).to.equal(2n);
    expect(stored.seller).to.equal(seller.address);
    expect(stored.buyer).to.equal(buyer.address);
    expect(stored.resolver).to.equal(resolver.address);
    expect(stored.amount).to.equal(amount);
    expect(stored.state).to.equal(STATE.Created);
    expect(stored.metadataHash).to.equal(created.metadataHash);
    expect(stored.termsHash).to.equal(created.termsHash);
    expect(stored.metadata).to.equal(created.metadata);
    expect(stored.evidenceHash).to.equal(ethers.ZeroHash);
    expect(await escrow.musdToken()).to.equal(await musd.getAddress());
    expect(stored.createdAt).to.equal(BigInt((await ethers.provider.getBlock(created.receipt!.blockNumber))!.timestamp));
  });

  it("rejects invalid creation parameters", async function () {
    const { escrow, seller, buyer, resolver, outsider, amount } = await deployFixture();
    const latest = BigInt(await time.latest());
    const funding = latest + BigInt(DAY);
    const delivery = funding + BigInt(MIN_GAP);
    const meta = buildMeta();
    const base = [
      buyer.address,
      resolver.address,
      amount,
      funding,
      delivery,
      MIN_REVIEW,
      meta.termsHash,
      meta.metadataHash,
      meta.metadata,
    ] as const;

    await expect(escrow.connect(seller).createEscrow(base[0], base[1], 0, base[3], base[4], base[5], base[6], base[7], base[8])).to.be.revertedWithCustomError(escrow, "ZeroAmount");
    await expect(escrow.connect(seller).createEscrow(seller.address, resolver.address, amount, funding, delivery, MIN_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "BuyerIsSeller");
    await expect(escrow.connect(seller).createEscrow(buyer.address, ethers.ZeroAddress, amount, funding, delivery, MIN_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    await expect(escrow.connect(seller).createEscrow(buyer.address, seller.address, amount, funding, delivery, MIN_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "ResolverIsParty");
    await expect(escrow.connect(seller).createEscrow(buyer.address, buyer.address, amount, funding, delivery, MIN_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "ResolverIsParty");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, delivery, MIN_REVIEW - 1, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "InvalidReviewPeriod");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, delivery, MAX_REVIEW + 1, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "InvalidReviewPeriod");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, latest, delivery, MIN_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "InvalidDeadline");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, funding + BigInt(MIN_GAP) - 1n, MIN_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "InvalidDeadline");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, delivery, MIN_REVIEW, ethers.ZeroHash, meta.metadataHash, meta.metadata)).to.be.revertedWithCustomError(escrow, "ZeroHash");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, delivery, MIN_REVIEW, meta.termsHash, hashText("other"), meta.metadata)).to.be.revertedWithCustomError(escrow, "HashMismatch");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, delivery, MIN_REVIEW, meta.termsHash, meta.metadataHash, "")).to.be.revertedWithCustomError(escrow, "InvalidMetadata");
    await expect(escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, delivery, MIN_REVIEW, meta.termsHash, hashText("x".repeat(2049)), "x".repeat(2049))).to.be.revertedWithCustomError(escrow, "InvalidMetadata");
    await expect(ethers.deployContract("RelayEscrow", [ethers.ZeroAddress])).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    await expect(escrow.getEscrow(0)).to.be.revertedWithCustomError(escrow, "EscrowNotFound");
    await expect(escrow.getEscrow(1)).to.be.revertedWithCustomError(escrow, "EscrowNotFound");
    expect(outsider.address).to.not.equal(seller.address);
  });

  it("accepts the exact horizon and review bounds", async function () {
    const { escrow, seller, buyer, resolver, amount } = await deployFixture();
    const target = BigInt(await time.latest()) + 20n;
    await time.setNextBlockTimestamp(Number(target));
    const delivery = target + BigInt(MAX_HORIZON);
    const funding = delivery - BigInt(MIN_GAP);
    const meta = buildMeta();
    await expect(
      escrow.connect(seller).createEscrow(buyer.address, resolver.address, amount, funding, delivery, MAX_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata),
    ).to.emit(escrow, "EscrowCreated");

    const later = BigInt(await time.latest()) + 20n;
    await time.setNextBlockTimestamp(Number(later));
    const tooLate = later + BigInt(MAX_HORIZON) + 1n;
    await expect(
      escrow.connect(seller).createEscrow(ethers.ZeroAddress, resolver.address, amount, tooLate - BigInt(MIN_GAP), tooLate, MIN_REVIEW, meta.termsHash, meta.metadataHash, meta.metadata),
    ).to.be.revertedWithCustomError(escrow, "InvalidDeadline");
  });

  it("funds a restricted escrow once and rejects the wrong buyer, duplicates, and short payments", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);

    await expect(escrow.connect(outsider).fundEscrow(created.id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
    await expect(escrow.connect(buyer).fundEscrow(created.id)).to.be.reverted;

    await expect(fund(musd, escrow, buyer, created.id, amount)).to.changeTokenBalances(
      musd,
      [buyer.address, await escrow.getAddress()],
      [-amount, amount],
    );

    const funded = await escrow.getEscrow(created.id);
    expect(funded.state).to.equal(STATE.Funded);
    expect(funded.buyer).to.equal(buyer.address);
    await expect(escrow.connect(buyer).fundEscrow(created.id)).to.be.revertedWithCustomError(escrow, "InvalidState");

    const fee = await ethers.deployContract("FeeOnTransferToken");
    await fee.waitForDeployment();
    const feeEscrow = await ethers.deployContract("RelayEscrow", [await fee.getAddress()]);
    await feeEscrow.waitForDeployment();
    await fee.mint(buyer.address, amount);
    const feeCreated = await createAgreement(feeEscrow, seller, resolver, buyer.address, amount);
    await fee.connect(buyer).approve(await feeEscrow.getAddress(), amount);
    await expect(feeEscrow.connect(buyer).fundEscrow(feeCreated.id)).to.be.revertedWithCustomError(feeEscrow, "UnexpectedTokenAmount");
    expect((await feeEscrow.getEscrow(feeCreated.id)).state).to.equal(STATE.Created);
    expect(await fee.balanceOf(buyer.address)).to.equal(amount);
  });

  it("binds an open checkout to the first funder and rejects seller or resolver funding", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, ethers.ZeroAddress, amount);
    expect((await escrow.getEscrow(created.id)).buyer).to.equal(ethers.ZeroAddress);

    await expect(escrow.connect(seller).fundEscrow(created.id)).to.be.revertedWithCustomError(escrow, "BuyerIsSeller");
    await musd.connect(seller).approve(await escrow.getAddress(), amount);
    await expect(fund(musd, escrow, resolver, created.id, amount)).to.be.revertedWithCustomError(escrow, "ResolverIsParty");

    await fund(musd, escrow, outsider, created.id, amount);
    expect((await escrow.getEscrow(created.id)).buyer).to.equal(outsider.address);
    await expect(fund(musd, escrow, buyer, created.id, amount)).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("releases the full amount when the buyer accepts delivery", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await fund(musd, escrow, buyer, created.id, amount);
    const evidence = buildEvidence();

    await expect(escrow.connect(buyer).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence)).to.be.revertedWithCustomError(escrow, "NotSeller");
    await expect(escrow.connect(seller).submitDelivery(created.id, ethers.ZeroHash, evidence.evidence)).to.be.revertedWithCustomError(escrow, "ZeroHash");
    await expect(escrow.connect(seller).submitDelivery(created.id, hashText("nope"), evidence.evidence)).to.be.revertedWithCustomError(escrow, "HashMismatch");

    const deliveryTx = await escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence);
    const delivered = await escrow.getEscrow(created.id);
    expect(delivered.state).to.equal(STATE.Delivered);
    expect(delivered.evidence).to.equal(evidence.evidence);
    expect(delivered.reviewDeadline).to.equal(BigInt((await ethers.provider.getBlock((await deliveryTx.wait())!.blockNumber))!.timestamp) + BigInt(created.reviewPeriod));

    await expect(escrow.connect(seller).releaseToSeller(created.id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
    await expect(escrow.connect(outsider).releaseToSeller(created.id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
    await expect(escrow.connect(buyer).refundAfterMissedDeadline(created.id)).to.be.revertedWithCustomError(escrow, "InvalidState");

    await expect(escrow.connect(buyer).releaseToSeller(created.id)).to.changeTokenBalances(
      musd,
      [await escrow.getAddress(), seller.address],
      [-amount, amount],
    );
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Released);
    await expect(escrow.connect(buyer).releaseToSeller(created.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await expect(escrow.connect(buyer).refundAfterMissedDeadline(created.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await expect(escrow.connect(resolver).resolveDispute(created.id, true)).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("refunds the buyer only after a missed delivery deadline", async function () {
    const { escrow, seller, buyer, resolver, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
      review: MIN_REVIEW,
    });
    await fund(musd, escrow, buyer, created.id, amount);

    await time.setNextBlockTimestamp(Number(created.deliveryDeadline));
    const evidence = buildEvidence();
    await expect(escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence, { gasLimit: 500_000 })).to.emit(escrow, "DeliverySubmitted");

    const missed = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
      review: MIN_REVIEW,
    });
    await fund(musd, escrow, buyer, missed.id, amount);
    await expect(escrow.connect(buyer).refundAfterMissedDeadline(missed.id)).to.be.revertedWithCustomError(escrow, "DeliveryWindowClosed");

    const exactRefund = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
      review: MIN_REVIEW,
    });
    await fund(musd, escrow, buyer, exactRefund.id, amount);
    await time.setNextBlockTimestamp(Number(exactRefund.deliveryDeadline));
    await expect(escrow.connect(buyer).refundAfterMissedDeadline(exactRefund.id, { gasLimit: 500_000 })).to.be.revertedWithCustomError(escrow, "DeliveryWindowClosed");

    const exactDelivery = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
      review: MIN_REVIEW,
    });
    await fund(musd, escrow, buyer, exactDelivery.id, amount);
    await time.setNextBlockTimestamp(Number(exactDelivery.deliveryDeadline));
    await expect(escrow.connect(seller).submitDelivery(exactDelivery.id, evidence.evidenceHash, evidence.evidence, { gasLimit: 500_000 })).to.emit(escrow, "DeliverySubmitted");

    const refundable = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
      review: MIN_REVIEW,
    });
    await fund(musd, escrow, buyer, refundable.id, amount);
    await time.setNextBlockTimestamp(Number(refundable.deliveryDeadline) + 1);
    await expect(escrow.connect(seller).submitDelivery(refundable.id, evidence.evidenceHash, evidence.evidence)).to.be.revertedWithCustomError(escrow, "DeliveryWindowClosed");
    await expect(escrow.connect(seller).refundAfterMissedDeadline(refundable.id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
    await expect(escrow.connect(buyer).refundAfterMissedDeadline(refundable.id)).to.changeTokenBalances(
      musd,
      [await escrow.getAddress(), buyer.address],
      [-amount, amount],
    );
    expect((await escrow.getEscrow(refundable.id)).state).to.equal(STATE.Refunded);
    await expect(escrow.connect(buyer).refundAfterMissedDeadline(refundable.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("auto-releases to the seller after the review window and not before", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount, { review: MIN_REVIEW });
    await fund(musd, escrow, buyer, created.id, amount);
    const evidence = buildEvidence();
    await escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence);
    const reviewDeadline = (await escrow.getEscrow(created.id)).reviewDeadline;

    await time.setNextBlockTimestamp(Number(reviewDeadline));
    await expect(escrow.connect(outsider).releaseAfterReviewWindow(created.id, { gasLimit: 500_000 })).to.be.revertedWithCustomError(escrow, "ReviewWindowOpen");

    const accepted = await createAgreement(escrow, seller, resolver, buyer.address, amount, { review: MIN_REVIEW });
    await fund(musd, escrow, buyer, accepted.id, amount);
    await escrow.connect(seller).submitDelivery(accepted.id, evidence.evidenceHash, evidence.evidence);
    const acceptAt = (await escrow.getEscrow(accepted.id)).reviewDeadline;
    await time.setNextBlockTimestamp(Number(acceptAt));
    await expect(escrow.connect(buyer).releaseToSeller(accepted.id, { gasLimit: 500_000 })).to.emit(escrow, "EscrowReleased");

    const expiring = await createAgreement(escrow, seller, resolver, buyer.address, amount, { review: MIN_REVIEW });
    await fund(musd, escrow, buyer, expiring.id, amount);
    await escrow.connect(seller).submitDelivery(expiring.id, evidence.evidenceHash, evidence.evidence);
    const exact = (await escrow.getEscrow(expiring.id)).reviewDeadline;
    await time.setNextBlockTimestamp(Number(exact));
    const reason = "The files do not match the agreement.";
    await expect(escrow.connect(seller).raiseDispute(expiring.id, hashText(reason), reason, { gasLimit: 500_000 })).to.emit(escrow, "DisputeRaised");
    await time.setNextBlockTimestamp(Number(exact) + 10);
    await expect(escrow.connect(outsider).releaseAfterReviewWindow(expiring.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await expect(escrow.connect(buyer).releaseToSeller(expiring.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await expect(escrow.connect(buyer).refundAfterMissedDeadline(expiring.id)).to.be.revertedWithCustomError(escrow, "InvalidState");

    const elapsed = await createAgreement(escrow, seller, resolver, buyer.address, amount, { review: MIN_REVIEW });
    await fund(musd, escrow, buyer, elapsed.id, amount);
    await escrow.connect(seller).submitDelivery(elapsed.id, evidence.evidenceHash, evidence.evidence);
    const deadline = (await escrow.getEscrow(elapsed.id)).reviewDeadline;
    await time.setNextBlockTimestamp(Number(deadline) + 1);
    await expect(escrow.connect(buyer).releaseToSeller(elapsed.id, { gasLimit: 500_000 })).to.be.revertedWithCustomError(escrow, "ReviewWindowClosed");
    await expect(escrow.connect(buyer).raiseDispute(elapsed.id, hashText(reason), reason, { gasLimit: 500_000 })).to.be.revertedWithCustomError(escrow, "ReviewWindowClosed");
    const outsiderBefore = await musd.balanceOf(outsider.address);
    await expect(escrow.connect(outsider).releaseAfterReviewWindow(elapsed.id)).to.changeTokenBalances(
      musd,
      [await escrow.getAddress(), seller.address],
      [-amount, amount],
    );
    expect(await musd.balanceOf(outsider.address)).to.equal(outsiderBefore);
    expect((await escrow.getEscrow(elapsed.id)).state).to.equal(STATE.Released);
    await expect(escrow.connect(outsider).releaseAfterReviewWindow(elapsed.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("lets only the stored resolver settle a dispute, once, for the full amount", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await fund(musd, escrow, buyer, created.id, amount);
    await expect(escrow.connect(buyer).raiseDispute(created.id, hashText("too early"), "too early")).to.be.revertedWithCustomError(escrow, "InvalidState");

    const evidence = buildEvidence();
    await escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence);
    await expect(escrow.connect(outsider).raiseDispute(created.id, hashText("nope"), "nope")).to.be.revertedWithCustomError(escrow, "NotParty");
    await expect(escrow.connect(buyer).raiseDispute(created.id, ethers.ZeroHash, "reason")).to.be.revertedWithCustomError(escrow, "ReasonInvalid");
    await expect(escrow.connect(buyer).raiseDispute(created.id, hashText("reason"), "different")).to.be.revertedWithCustomError(escrow, "HashMismatch");

    const reason = "The delivered archive is incomplete.";
    await escrow.connect(buyer).raiseDispute(created.id, hashText(reason), reason);
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Disputed);
    await expect(escrow.connect(outsider).resolveDispute(created.id, true)).to.be.revertedWithCustomError(escrow, "NotResolver");
    await expect(escrow.connect(seller).resolveDispute(created.id, true)).to.be.revertedWithCustomError(escrow, "NotResolver");
    await expect(escrow.connect(resolver).resolveDispute(created.id, false)).to.changeTokenBalances(
      musd,
      [await escrow.getAddress(), buyer.address],
      [-amount, amount],
    );
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Refunded);
    await expect(escrow.connect(resolver).resolveDispute(created.id, true)).to.be.revertedWithCustomError(escrow, "InvalidState");

    const paySeller = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await fund(musd, escrow, buyer, paySeller.id, amount);
    await escrow.connect(seller).submitDelivery(paySeller.id, evidence.evidenceHash, evidence.evidence);
    await escrow.connect(seller).raiseDispute(paySeller.id, hashText(reason), reason);
    await expect(resolver).to.not.equal(undefined);
    await expect(escrow.connect(resolver).resolveDispute(paySeller.id, true)).to.changeTokenBalances(
      musd,
      [await escrow.getAddress(), seller.address],
      [-amount, amount],
    );
    expect((await escrow.getEscrow(paySeller.id)).state).to.equal(STATE.Released);
  });

  it("lets the resolver split a disputed amount and rejects a full-side split", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    expect(await escrow.partialSettlementSupported()).to.equal(true);
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await fund(musd, escrow, buyer, created.id, amount);
    const evidence = buildEvidence();
    await escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence);
    const reason = "Split the unfinished portion.";
    await escrow.connect(buyer).raiseDispute(created.id, hashText(reason), reason);

    const sellerAmount = ethers.parseEther("20");
    const buyerAmount = amount - sellerAmount;
    await expect(escrow.connect(outsider).resolveDisputeSplit(created.id, sellerAmount)).to.be.revertedWithCustomError(escrow, "NotResolver");
    await expect(escrow.connect(resolver).resolveDisputeSplit(created.id, 0)).to.be.revertedWithCustomError(escrow, "SplitAmount");
    await expect(escrow.connect(resolver).resolveDisputeSplit(created.id, amount)).to.be.revertedWithCustomError(escrow, "SplitAmount");
    await expect(escrow.connect(resolver).resolveDisputeSplit(created.id, sellerAmount)).to.changeTokenBalances(
      musd,
      [await escrow.getAddress(), seller.address, buyer.address],
      [-amount, sellerAmount, buyerAmount],
    );
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Split);
    await expect(escrow.connect(resolver).resolveDisputeSplit(created.id, sellerAmount)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await expect(escrow.connect(resolver).resolveDispute(created.id, true)).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("cancels unfunded escrows without moving tokens", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await expect(escrow.connect(outsider).cancelUnfunded(created.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await expect(escrow.connect(seller).cancelUnfunded(created.id)).to.emit(escrow, "EscrowCancelled");
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Cancelled);
    await expect(escrow.connect(buyer).fundEscrow(created.id)).to.be.revertedWithCustomError(escrow, "InvalidState");

    const expired = await createAgreement(escrow, seller, resolver, buyer.address, amount, { fundingIn: HOUR, deliveryAfterFunding: MIN_GAP });
    await time.setNextBlockTimestamp(Number(expired.fundingDeadline));
    await expect(escrow.connect(outsider).cancelUnfunded(expired.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await time.setNextBlockTimestamp(Number(expired.fundingDeadline) + 1);
    await expect(escrow.connect(outsider).cancelUnfunded(expired.id)).to.emit(escrow, "EscrowCancelled");

    const funded = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await fund(musd, escrow, buyer, funded.id, amount);
    await expect(escrow.connect(seller).cancelUnfunded(funded.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
    expect(await musd.balanceOf(await escrow.getAddress())).to.equal(amount);
  });

  it("keeps separate escrows solvent and ignores direct token donations", async function () {
    const { escrow, seller, buyer, resolver, outsider, donor, musd, amount } = await deployFixture();
    const first = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    const second = await createAgreement(escrow, seller, resolver, outsider.address, amount * 2n);
    await fund(musd, escrow, buyer, first.id, amount);
    await musd.connect(outsider).approve(await escrow.getAddress(), amount * 2n);
    await escrow.connect(outsider).fundEscrow(second.id);
    await musd.mint(donor.address, 7n);
    await musd.connect(donor).transfer(await escrow.getAddress(), 7n);

    const evidence = buildEvidence();
    await escrow.connect(seller).submitDelivery(first.id, evidence.evidenceHash, evidence.evidence);
    await escrow.connect(buyer).releaseToSeller(first.id);

    expect((await escrow.getEscrow(second.id)).state).to.equal(STATE.Funded);
    expect((await escrow.getEscrow(second.id)).amount).to.equal(amount * 2n);
    expect(await musd.balanceOf(await escrow.getAddress())).to.equal(amount * 2n + 7n);

    await time.increaseTo(second.deliveryDeadline + 1n);
    await escrow.connect(outsider).refundAfterMissedDeadline(second.id);
    expect(await musd.balanceOf(await escrow.getAddress())).to.equal(7n);
    expect((await escrow.getEscrow(first.id)).state).to.equal(STATE.Released);
    expect((await escrow.getEscrow(second.id)).state).to.equal(STATE.Refunded);
  });

  it("closes the funding window and rejects delivery before funding", async function () {
    const { escrow, seller, buyer, resolver, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
    });
    await musd.connect(buyer).approve(await escrow.getAddress(), amount);
    await time.setNextBlockTimestamp(Number(created.fundingDeadline));
    await expect(escrow.connect(buyer).fundEscrow(created.id)).to.emit(escrow, "EscrowFunded");

    const closed = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
    });
    await musd.connect(buyer).approve(await escrow.getAddress(), amount);
    await time.setNextBlockTimestamp(Number(closed.fundingDeadline) + 1);
    await expect(escrow.connect(buyer).fundEscrow(closed.id)).to.be.revertedWithCustomError(escrow, "FundingClosed");
    const evidence = buildEvidence();
    await expect(escrow.connect(seller).submitDelivery(closed.id, evidence.evidenceHash, evidence.evidence)).to.be.revertedWithCustomError(escrow, "InvalidState");
    await expect(escrow.connect(buyer).releaseToSeller(closed.id)).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("blocks reentrancy on funding and release", async function () {
    const { seller, buyer, resolver, amount } = await deployFixture();
    const token = await ethers.deployContract("ReenteringToken");
    await token.waitForDeployment();
    const escrow = await ethers.deployContract("RelayEscrow", [await token.getAddress()]);
    await escrow.waitForDeployment();
    await token.setEscrow(await escrow.getAddress());
    await token.mint(buyer.address, amount);
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await token.connect(buyer).approve(await escrow.getAddress(), amount);
    await token.setAttack(created.id, true, false);
    await expect(escrow.connect(buyer).fundEscrow(created.id)).to.be.revertedWithCustomError(escrow, "ReentrancyGuardReentrantCall");
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Created);
    expect(await token.balanceOf(buyer.address)).to.equal(amount);

    await token.setAttack(created.id, false, false);
    await escrow.connect(buyer).fundEscrow(created.id);
    const evidence = buildEvidence();
    await escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence);
    await token.setAttack(created.id, false, true);
    await expect(escrow.connect(buyer).releaseToSeller(created.id)).to.be.revertedWithCustomError(escrow, "ReentrancyGuardReentrantCall");
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Delivered);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);
  });

  it("orders conflicting same-block actions so only one settlement can succeed", async function () {
    const { escrow, seller, buyer, resolver, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount, {
      fundingIn: HOUR,
      deliveryAfterFunding: MIN_GAP,
      review: MIN_REVIEW,
    });
    await fund(musd, escrow, buyer, created.id, amount);
    const evidence = buildEvidence();

    await network.provider.send("evm_setAutomine", [false]);
    try {
      await time.setNextBlockTimestamp(Number(created.deliveryDeadline));
      const submit = await escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence, { gasLimit: 500_000 });
      const refund = await escrow.connect(buyer).refundAfterMissedDeadline(created.id, { gasLimit: 500_000 });
      await network.provider.send("evm_mine");
      const submitReceipt = await receiptOf(submit);
      const refundReceipt = await receiptOf(refund);
      expect(submitReceipt?.status).to.equal(1);
      expect(refundReceipt?.status).to.equal(0);
      expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Delivered);
    } finally {
      await network.provider.send("evm_setAutomine", [true]);
    }

    const disputed = await createAgreement(escrow, seller, resolver, buyer.address, amount, { review: MIN_REVIEW });
    await fund(musd, escrow, buyer, disputed.id, amount);
    await escrow.connect(seller).submitDelivery(disputed.id, evidence.evidenceHash, evidence.evidence);
    const reason = "Need a resolver decision.";
    await network.provider.send("evm_setAutomine", [false]);
    try {
      const release = await escrow.connect(buyer).releaseToSeller(disputed.id, { gasLimit: 500_000 });
      const dispute = await escrow.connect(seller).raiseDispute(disputed.id, hashText(reason), reason, { gasLimit: 500_000 });
      await network.provider.send("evm_mine");
      const releaseReceipt = await receiptOf(release);
      const disputeReceipt = await receiptOf(dispute);
      const successes = [releaseReceipt, disputeReceipt].filter((receipt) => receipt?.status === 1).length;
      expect(successes).to.equal(1);
      const state = (await escrow.getEscrow(disputed.id)).state;
      expect(state === STATE.Released || state === STATE.Disputed).to.equal(true);
      const sellerBalance = await musd.balanceOf(seller.address);
      const contractBalance = await musd.balanceOf(await escrow.getAddress());
      if (state === STATE.Released) {
        expect(sellerBalance).to.equal(ethers.parseEther("1000") + amount);
        expect(contractBalance).to.equal(amount);
      } else {
        expect(contractBalance).to.equal(amount * 2n);
        expect(sellerBalance).to.equal(ethers.parseEther("1000"));
      }
    } finally {
      await network.provider.send("evm_setAutomine", [true]);
    }
  });

  it("lets an agent fund only inside the buyer's remaining budget", async function () {
    const { escrow, seller, buyer, resolver, outsider, musd, amount } = await deployFixture();
    const agent = outsider;
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await expect(escrow.connect(buyer).setAgentAllowance(ethers.ZeroAddress, amount)).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    await expect(escrow.connect(buyer).setAgentAllowance(buyer.address, amount)).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    await expect(escrow.connect(agent).fundEscrowAsAgent(created.id)).to.be.revertedWithCustomError(escrow, "AgentAllowance");

    await escrow.connect(buyer).setAgentAllowance(agent.address, amount - 1n);
    await musd.connect(buyer).approve(await escrow.getAddress(), amount);
    await expect(escrow.connect(agent).fundEscrowAsAgent(created.id)).to.be.revertedWithCustomError(escrow, "AgentAllowance");
    expect(await escrow.agentAllowance(buyer.address, agent.address)).to.equal(amount - 1n);

    await escrow.connect(buyer).setAgentAllowance(agent.address, amount);
    await expect(escrow.connect(seller).fundEscrowAsAgent(created.id)).to.be.revertedWithCustomError(escrow, "AgentNotAllowed");
    await expect(escrow.connect(resolver).fundEscrowAsAgent(created.id)).to.be.revertedWithCustomError(escrow, "AgentNotAllowed");
    await expect(escrow.connect(buyer).fundEscrowAsAgent(created.id)).to.be.revertedWithCustomError(escrow, "AgentNotAllowed");

    await expect(escrow.connect(agent).fundEscrowAsAgent(created.id)).to.changeTokenBalances(
      musd,
      [buyer.address, await escrow.getAddress()],
      [-amount, amount],
    );
    const funded = await escrow.getEscrow(created.id);
    expect(funded.state).to.equal(STATE.Funded);
    expect(funded.buyer).to.equal(buyer.address);
    expect(await escrow.agentAllowance(buyer.address, agent.address)).to.equal(0n);
    await expect(escrow.connect(agent).releaseToSeller(created.id)).to.be.revertedWithCustomError(escrow, "NotBuyer");

    const open = await createAgreement(escrow, seller, resolver, ethers.ZeroAddress, amount);
    await escrow.connect(buyer).setAgentAllowance(agent.address, amount);
    await expect(escrow.connect(agent).fundEscrowAsAgent(open.id)).to.be.revertedWithCustomError(escrow, "NotBuyer");

    await escrow.connect(buyer).setAgentAllowance(agent.address, 0n);
    const revoked = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    await musd.connect(buyer).approve(await escrow.getAddress(), amount);
    await expect(escrow.connect(agent).fundEscrowAsAgent(revoked.id)).to.be.revertedWithCustomError(escrow, "AgentAllowance");
  });

  it("runs the full protected payment and an independent refund", async function () {
    const { escrow, seller, buyer, resolver, musd, amount } = await deployFixture();
    const created = await createAgreement(escrow, seller, resolver, buyer.address, amount);
    expect((await escrow.getEscrow(created.id)).metadataHash).to.equal(created.metadataHash);

    await fund(musd, escrow, buyer, created.id, amount);
    expect(await musd.balanceOf(await escrow.getAddress())).to.equal(amount);

    const evidence = buildEvidence("Final files are ready", "https://example.com/relay-delivery");
    await escrow.connect(seller).submitDelivery(created.id, evidence.evidenceHash, evidence.evidence);
    await escrow.connect(buyer).releaseToSeller(created.id);

    const settled = await escrow.getEscrow(created.id);
    expect(settled.state).to.equal(STATE.Released);
    expect(settled.evidenceHash).to.equal(evidence.evidenceHash);
    expect(await musd.balanceOf(seller.address)).to.equal(ethers.parseEther("1000") + amount);

    const refundable = await createAgreement(escrow, seller, resolver, buyer.address, ethers.parseEther("20"), {
      fundingIn: 2 * HOUR,
      deliveryAfterFunding: MIN_GAP,
    });
    await fund(musd, escrow, buyer, refundable.id, ethers.parseEther("20"));
    await time.increaseTo(refundable.deliveryDeadline + 1n);
    await escrow.connect(buyer).refundAfterMissedDeadline(refundable.id);
    expect((await escrow.getEscrow(refundable.id)).state).to.equal(STATE.Refunded);
    expect((await escrow.getEscrow(created.id)).state).to.equal(STATE.Released);
  });
});
