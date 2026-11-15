const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const MUSD = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const HOUR = 60 * 60;
const DAY = 24 * HOUR;

function hashText(value) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(value));
}

function buildMeta(title) {
  const terms = "Deliver the agreed files.";
  const termsHash = hashText(terms);
  const metadata = JSON.stringify({ v: 1, title, description: "Rules evidence.", terms, termsHash });
  return { termsHash, metadata, metadataHash: hashText(metadata) };
}

function buildEvidence() {
  const evidence = JSON.stringify({ v: 1, note: "Files are ready.", url: "https://explorer.test.mezo.org" });
  return { evidence, evidenceHash: hashText(evidence) };
}

async function waitTx(tx) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error(`Transaction failed: ${receipt?.hash}`);
      return receipt.hash;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("method handler crashed") && !message.includes("could not be found")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

async function main() {
  const deployment = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployments", "mezo-testnet.json"), "utf8"));
  const [seller] = await hre.ethers.getSigners();
  if (seller.address.toLowerCase() !== "0x39b6fd99d31a67475911d9d763b0bd8323f99685") {
    throw new Error("The signer is not the seller wallet.");
  }
  const buyer = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const resolver = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const escrow = await hre.ethers.getContractAt("RelayEscrow", deployment.address);
  const musd = await hre.ethers.getContractAt(
    ["function transfer(address,uint256) returns (bool)", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    MUSD,
  );
  const gas = hre.ethers.parseEther("0.0004");
  const sellerGas = await hre.ethers.provider.getBalance(seller.address);
  if (sellerGas < gas * 4n) throw new Error("The seller wallet does not have enough BTC for these transactions.");
  const amount = hre.ethers.parseEther("2");
  const resolverFee = hre.ethers.parseEther("0.1");
  if (await musd.balanceOf(seller.address) < amount * 2n) throw new Error("The seller wallet does not have enough MUSD.");

  await waitTx(await seller.sendTransaction({ to: buyer.address, value: gas }));
  await waitTx(await seller.sendTransaction({ to: resolver.address, value: gas }));
  await waitTx(await musd.transfer(buyer.address, amount * 2n));

  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const funding = now + DAY;
  const delivery = funding + DAY;
  const meta = buildMeta("First stage");
  const firstId = await escrow.createEscrow.staticCall(
    buyer.address, resolver.address, amount, funding, delivery, HOUR, meta.termsHash, meta.metadataHash, meta.metadata, 0, resolverFee,
  );
  await waitTx(await escrow.createEscrow(
    buyer.address, resolver.address, amount, funding, delivery, HOUR, meta.termsHash, meta.metadataHash, meta.metadata, 0, resolverFee,
  ));
  const resolverAccepted = await waitTx(await escrow.connect(buyer).acceptResolver(firstId));
  await waitTx(await musd.connect(buyer).approve(deployment.address, amount * 2n));
  await waitTx(await escrow.connect(buyer).fundEscrow(firstId));

  const secondMeta = buildMeta("Second stage");
  const secondId = await escrow.createEscrow.staticCall(
    buyer.address, resolver.address, amount, funding, delivery, HOUR, secondMeta.termsHash, secondMeta.metadataHash, secondMeta.metadata, firstId, resolverFee,
  );
  await waitTx(await escrow.createEscrow(
    buyer.address, resolver.address, amount, funding, delivery, HOUR, secondMeta.termsHash, secondMeta.metadataHash, secondMeta.metadata, firstId, resolverFee,
  ));
  await waitTx(await escrow.connect(buyer).acceptResolver(secondId));
  await escrow.connect(buyer).fundEscrow(secondId).then(() => { throw new Error("The second stage funded before the first was released."); }, () => undefined);

  const evidence = buildEvidence();
  await waitTx(await escrow.submitDelivery(firstId, evidence.evidenceHash, evidence.evidence));
  const stored = await escrow.getEscrow(firstId);
  const extended = stored.reviewDeadline + 3600n;
  await waitTx(await escrow.connect(buyer).proposeReviewExtension(firstId, extended));
  const reviewExtension = await waitTx(await escrow.connect(seller).acceptReviewExtension(firstId));
  if ((await escrow.getEscrow(firstId)).reviewDeadline !== extended) throw new Error("The review deadline did not move.");
  await waitTx(await escrow.connect(buyer).releaseToSeller(firstId));
  const gatedFund = await waitTx(await escrow.connect(buyer).fundEscrow(secondId));

  await waitTx(await escrow.submitDelivery(secondId, evidence.evidenceHash, evidence.evidence));
  const reason = "Settle this dispute.";
  await waitTx(await escrow.connect(buyer).raiseDispute(secondId, hashText(reason), reason));
  const resolverBefore = await musd.balanceOf(resolver.address);
  const resolverPaid = await waitTx(await escrow.connect(resolver).resolveDispute(secondId, false));
  const resolverAfter = await musd.balanceOf(resolver.address);
  if (resolverAfter !== resolverBefore + resolverFee) throw new Error("The resolver fee was not paid.");

  const file = path.join(process.cwd(), "deployments", "wave2-evidence.json");
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  record.rulesEscrow = deployment.address;
  record.resolverAccepted = resolverAccepted;
  record.reviewExtension = reviewExtension;
  record.gatedFund = gatedFund;
  record.resolverPaid = resolverPaid;
  record.rulesRecordedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify({ resolverAccepted, reviewExtension, gatedFund, resolverPaid, escrow: deployment.address }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
