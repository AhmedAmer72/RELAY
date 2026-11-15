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
  const metadata = JSON.stringify({ v: 1, title, description: "Depth evidence.", terms, termsHash });
  return { termsHash, metadata, metadataHash: hashText(metadata) };
}

function buildEvidence() {
  const evidence = JSON.stringify({ v: 1, note: "Files delivered by the agent.", url: "https://explorer.test.mezo.org" });
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
    throw new Error("The signer is not the seller wallet used for the earlier deposit.");
  }
  const buyer = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const agent = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const resolver = hre.ethers.Wallet.createRandom();
  const escrow = await hre.ethers.getContractAt("RelayEscrow", deployment.address);
  const musd = await hre.ethers.getContractAt(
    ["function transfer(address,uint256) returns (bool)", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    MUSD,
  );
  const gas = hre.ethers.parseEther("0.0005");
  const sellerGas = await hre.ethers.provider.getBalance(seller.address);
  if (sellerGas < gas * 3n) throw new Error("The seller wallet does not have enough BTC for these transactions.");
  const amount = hre.ethers.parseEther("10");
  const sellerMusd = await musd.balanceOf(seller.address);
  if (sellerMusd < amount * 2n) throw new Error("The seller wallet does not have enough MUSD to fund the evidence agreements.");

  await waitTx(await seller.sendTransaction({ to: buyer.address, value: gas }));
  await waitTx(await seller.sendTransaction({ to: agent.address, value: gas }));
  await waitTx(await musd.transfer(buyer.address, amount));

  const evidenceFile = path.join(process.cwd(), "deployments", "wave2-evidence.json");
  const existing = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));
  if (existing.mutualCancel && existing.agentDelivery) {
    console.log(JSON.stringify({ mutualCancel: existing.mutualCancel, agentDelivery: existing.agentDelivery, escrow: deployment.address }));
    return;
  }

  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const funding = now + DAY;
  const delivery = funding + DAY;
  const meta = buildMeta("Mutual cancel");
  const cancelId = await escrow.createEscrow.staticCall(buyer.address, resolver.address, amount, funding, delivery, HOUR, meta.termsHash, meta.metadataHash, meta.metadata);
  await waitTx(await escrow.createEscrow(buyer.address, resolver.address, amount, funding, delivery, HOUR, meta.termsHash, meta.metadataHash, meta.metadata));
  await waitTx(await musd.connect(buyer).approve(deployment.address, amount));
  await waitTx(await escrow.connect(buyer).fundEscrow(cancelId));
  const buyerBefore = await musd.balanceOf(buyer.address);
  await waitTx(await escrow.connect(seller).proposeMutualCancel(cancelId));
  const mutualCancel = await waitTx(await escrow.connect(buyer).acceptMutualCancel(cancelId));
  const buyerAfter = await musd.balanceOf(buyer.address);
  if (buyerAfter !== buyerBefore + amount) throw new Error("The mutual cancel did not return the full MUSD amount.");

  const evidence = buildEvidence();
  const deliveryMeta = buildMeta("Agent delivery");
  const deliveryId = await escrow.createEscrow.staticCall(buyer.address, resolver.address, amount, funding, delivery, HOUR, deliveryMeta.termsHash, deliveryMeta.metadataHash, deliveryMeta.metadata);
  await waitTx(await escrow.createEscrow(buyer.address, resolver.address, amount, funding, delivery, HOUR, deliveryMeta.termsHash, deliveryMeta.metadataHash, deliveryMeta.metadata));
  await waitTx(await musd.transfer(buyer.address, amount));
  await waitTx(await musd.connect(buyer).approve(deployment.address, amount));
  await waitTx(await escrow.connect(buyer).fundEscrow(deliveryId));
  await waitTx(await escrow.setDeliveryAgent(agent.address, true));
  const agentDelivery = await waitTx(await escrow.connect(agent).submitDeliveryAsAgent(deliveryId, evidence.evidenceHash, evidence.evidence));
  const stored = await escrow.getEscrow(deliveryId);
  if (Number(stored.state) !== 2) throw new Error("Agent delivery did not mark the agreement delivered.");

  const file = path.join(process.cwd(), "deployments", "wave2-evidence.json");
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  record.depthEscrow = deployment.address;
  record.mutualCancel = mutualCancel;
  record.agentDelivery = agentDelivery;
  record.depthRecordedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify({ mutualCancel, agentDelivery, escrow: deployment.address }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
