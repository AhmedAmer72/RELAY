const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ESCROW = "0x7b31489D0da4b745E26689647FC1514071De3fD4";
const MUSD = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const POOL = "0x1CCA7E410eE41739792eA0A24e00349Dd247680e";
const BORROWER = "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5";
const TROVE = "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0";
const HINTS = "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6";
const SORTED = "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA";
const PRICE = "0x86bCF0841622a5dAC14A313a15f96A95421b9366";
const HOUR = 60 * 60;
const MIN_ICR = 150n * 10n ** 16n;

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

async function createAndFund(escrow, musd, seller, buyer, resolver, amount, fundingIn, deliveryAfterFunding) {
  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const funding = now + fundingIn;
  const delivery = funding + deliveryAfterFunding;
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
  if (seller.address.toLowerCase() !== "0x39b6fd99d31a67475911d9d763b0bd8323f99685") {
    throw new Error("The signer is not the seller wallet.");
  }
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
  const gas = hre.ethers.parseEther("0.0003");
  if (await hre.ethers.provider.getBalance(seller.address) < gas * 4n) {
    throw new Error("The seller wallet does not have enough BTC.");
  }
  const amount = hre.ethers.parseEther("4");
  if (await musd.balanceOf(seller.address) < amount * 3n + hre.ethers.parseEther("1")) {
    throw new Error("The seller wallet does not have enough MUSD.");
  }
  await waitTx(await seller.sendTransaction({ to: buyer.address, value: gas }));
  await waitTx(await seller.sendTransaction({ to: resolver.address, value: gas }));
  await waitTx(await musd.transfer(buyer.address, amount * 3n));

  const record = { escrow: ESCROW, recordedAt: new Date().toISOString() };
  const evidence = buildEvidence();
  const fee = await escrow.protocolFee(amount);

  const released = await createAndFund(escrow, musd, seller, buyer, resolver, amount, 90, HOUR);
  await waitTx(await escrow.submitDelivery(released.id, evidence.evidenceHash, evidence.evidence));
  const sellerBefore = await musd.balanceOf(seller.address);
  record.release = await waitTx(await escrow.connect(buyer).releaseToSeller(released.id));
  const sellerGain = (await musd.balanceOf(seller.address)) - sellerBefore;
  if (seller.address.toLowerCase() === (await escrow.feeRecipient()).toLowerCase()) {
    if (sellerGain !== amount) throw new Error("Release did not return the gross amount to the fee-recipient seller.");
  } else if (sellerGain !== amount - fee) {
    throw new Error(`Release paid ${sellerGain} instead of amount minus the 0.50% fee.`);
  }

  const refundable = await createAndFund(escrow, musd, seller, buyer, resolver, amount, 90, HOUR);
  const splitDeal = await createAndFund(escrow, musd, seller, buyer, resolver, amount, 120, HOUR);
  await waitTx(await escrow.submitDelivery(splitDeal.id, evidence.evidenceHash, evidence.evidence));
  const reason = "Split this agreement.";
  await waitTx(await escrow.connect(buyer).raiseDispute(splitDeal.id, hashText(reason), reason));
  const sellerPart = amount / 2n;
  record.split = await waitTx(await escrow.connect(resolver).resolveDisputeSplit(splitDeal.id, sellerPart));
  if (Number((await escrow.getEscrow(splitDeal.id)).state) !== 7) throw new Error("The split did not settle.");

  const park = hre.ethers.parseEther("1");
  await waitTx(await musd.approve(POOL, park));
  record.stabilityDeposit = await waitTx(await pool.provideToSP(park));
  const parked = await pool.getCompoundedMUSDDeposit(seller.address);
  if (parked === 0n) throw new Error("The Stability Pool deposit was not credited.");
  const musdBefore = await musd.balanceOf(seller.address);
  record.stabilityWithdraw = await waitTx(await pool.withdrawFromSP(parked));
  if ((await musd.balanceOf(seller.address)) <= musdBefore) throw new Error("The Stability Pool withdrawal did not return MUSD.");
  record.stabilityDepositAfter = (await pool.getCompoundedMUSDDeposit(seller.address)).toString();

  try {
    const trove = await hre.ethers.getContractAt(
      ["function getTroveStatus(address) view returns (uint8)", "function getTroveColl(address) view returns (uint256)", "function getTroveDebt(address) view returns (uint256)"],
      TROVE,
    );
    const borrower = await hre.ethers.getContractAt(
      ["function getBorrowingFee(uint256) view returns (uint256)", "function withdrawMUSD(uint256,address,address)"],
      BORROWER,
    );
    const priceFeed = await hre.ethers.getContractAt(["function fetchPrice() view returns (uint256)"], PRICE);
    const hints = await hre.ethers.getContractAt(["function getApproxHint(uint256,uint256,uint256) view returns (address,uint256,uint256)"], HINTS);
    const sorted = await hre.ethers.getContractAt(["function findInsertPosition(uint256,address,address) view returns (address,address)"], SORTED);
    if (await trove.getTroveStatus(seller.address) !== 1n) throw new Error("The seller trove is not active.");
    const borrowAmount = hre.ethers.parseEther("1");
    const coll = await trove.getTroveColl(seller.address);
    const debt = await trove.getTroveDebt(seller.address);
    const price = await priceFeed.fetchPrice();
    const nextDebt = debt + borrowAmount + await borrower.getBorrowingFee(borrowAmount);
    const nextRatio = coll * price / nextDebt;
    if (nextRatio < MIN_ICR) throw new Error(`Borrowing 1 MUSD would leave the collateral ratio at ${nextRatio}.`);
    const nicr = coll * 10n ** 20n / nextDebt;
    const approx = await hints.getApproxHint(nicr, 15, 42);
    const position = await sorted.findInsertPosition(nicr, approx[0], approx[0]);
    record.borrow = await waitTx(await borrower.withdrawMUSD(borrowAmount, position[0], position[1]));
  } catch (error) {
    record.borrowError = error instanceof Error ? error.message : "Borrow did not complete.";
  }

  const latest = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const waitSeconds = Number(refundable.delivery) + 5 - latest;
  if (waitSeconds > 0) await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  const buyerBefore = await musd.balanceOf(buyer.address);
  record.refund = await waitTx(await escrow.connect(buyer).refundAfterMissedDeadline(refundable.id));
  if ((await musd.balanceOf(buyer.address)) !== buyerBefore + amount) throw new Error("The refund did not return the full amount.");

  const file = path.join(process.cwd(), "deployments", "current-evidence.json");
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify(record));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
