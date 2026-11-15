const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ESCROW = "0x7b31489D0da4b745E26689647FC1514071De3fD4";
const MUSD = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const POOL = "0x1CCA7E410eE41739792eA0A24e00349Dd247680e";
const HOUR = 60 * 60;

function hashText(value) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(value));
}

function buildMeta(title) {
  const terms = "Deliver the agreed files.";
  const termsHash = hashText(terms);
  const metadata = JSON.stringify({ v: 1, title, description: "Current escrow evidence.", terms, termsHash });
  return { termsHash, metadata, metadataHash: hashText(metadata) };
}

function buildEvidence() {
  const evidence = JSON.stringify({ v: 1, note: "Files delivered.", url: "https://explorer.test.mezo.org" });
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

async function createAndFund(escrow, musd, buyer, resolver, amount) {
  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const funding = now + 90;
  const delivery = funding + HOUR;
  const meta = buildMeta(`Evidence ${funding}`);
  const id = await escrow.createEscrow.staticCall(
    buyer.address, resolver.address, amount, funding, delivery, 15 * 60, meta.termsHash, meta.metadataHash, meta.metadata, 0, 0,
  );
  await waitTx(await escrow.createEscrow(
    buyer.address, resolver.address, amount, funding, delivery, 15 * 60, meta.termsHash, meta.metadataHash, meta.metadata, 0, 0,
  ));
  await waitTx(await escrow.connect(buyer).acceptResolver(id));
  await waitTx(await musd.connect(buyer).approve(ESCROW, amount));
  await waitTx(await escrow.connect(buyer).fundEscrow(id));
  return { id, delivery };
}

async function main() {
  const [seller] = await hre.ethers.getSigners();
  const buyer = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const resolver = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  const escrow = await hre.ethers.getContractAt("RelayEscrow", ESCROW);
  const musd = await hre.ethers.getContractAt(
    ["function transfer(address,uint256) returns (bool)", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    MUSD,
  );
  const pool = await hre.ethers.getContractAt(
    ["function provideToSP(uint256)", "function withdrawFromSP(uint256)", "function getCompoundedMUSDDeposit(address) view returns (uint256)"],
    POOL,
  );
  const gas = hre.ethers.parseEther("0.00025");
  if (await hre.ethers.provider.getBalance(seller.address) < gas * 4n) throw new Error("Not enough BTC.");
  const amount = hre.ethers.parseEther("4");
  if (await musd.balanceOf(seller.address) < amount * 2n + hre.ethers.parseEther("1")) throw new Error("Not enough MUSD.");
  await waitTx(await seller.sendTransaction({ to: buyer.address, value: gas }));
  await waitTx(await seller.sendTransaction({ to: resolver.address, value: gas }));
  await waitTx(await musd.transfer(buyer.address, amount * 2n));

  const record = {
    escrow: ESCROW,
    release: "0xffac7be42e45fa4da98d62f3b8d2a7a67ffb40caffb6d98ddad4d8c161817f73",
    releaseFee: "20000000000000000",
    releaseNet: "3980000000000000000",
  };
  const evidence = buildEvidence();
  const refundable = await createAndFund(escrow, musd, buyer, resolver, amount);
  const splitDeal = await createAndFund(escrow, musd, buyer, resolver, amount);
  await waitTx(await escrow.submitDelivery(splitDeal.id, evidence.evidenceHash, evidence.evidence));
  const reason = "Split this agreement.";
  await waitTx(await escrow.connect(buyer).raiseDispute(splitDeal.id, hashText(reason), reason));
  record.split = await waitTx(await escrow.connect(resolver).resolveDisputeSplit(splitDeal.id, amount / 2n));

  const park = hre.ethers.parseEther("1");
  await waitTx(await musd.approve(POOL, park));
  record.stabilityDeposit = await waitTx(await pool.provideToSP(park));
  const parked = await pool.getCompoundedMUSDDeposit(seller.address);
  if (parked === 0n) throw new Error("Stability Pool deposit was not credited.");
  const before = await musd.balanceOf(seller.address);
  record.stabilityWithdraw = await waitTx(await pool.withdrawFromSP(parked));
  if ((await musd.balanceOf(seller.address)) <= before) throw new Error("Withdrawal did not return MUSD.");

  const latest = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const waitSeconds = Number(refundable.delivery) + 8 - latest;
  if (waitSeconds > 0) {
    console.log(`waiting ${waitSeconds}s for the refund deadline`);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }
  const buyerBefore = await musd.balanceOf(buyer.address);
  record.refund = await waitTx(await escrow.connect(buyer).refundAfterMissedDeadline(refundable.id));
  if ((await musd.balanceOf(buyer.address)) !== buyerBefore + amount) throw new Error("Refund was not the full amount.");
  record.recordedAt = new Date().toISOString();
  fs.writeFileSync(path.join(process.cwd(), "deployments", "current-evidence.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify(record));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
