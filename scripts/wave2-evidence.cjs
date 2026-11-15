const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ESCROW = "0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F";
const MUSD = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const BORROWER = "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5";
const TROVE_MANAGER = "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0";
const HINTS = "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6";
const SORTED = "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA";
const PRICE = "0x86bCF0841622a5dAC14A313a15f96A95421b9366";
const POOL = "0x1CCA7E410eE41739792eA0A24e00349Dd247680e";
const MIN_ICR = 150n * 10n ** 16n;
const HOUR = 60 * 60;
const DAY = 24 * HOUR;

function hashText(value) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(value));
}

function buildMeta(title) {
  const terms = "Deliver the agreed files.";
  const termsHash = hashText(terms);
  const metadata = JSON.stringify({ v: 1, title, description: "Wave 2 evidence.", terms, termsHash });
  return { termsHash, metadata, metadataHash: hashText(metadata) };
}

function buildEvidence(note) {
  const evidence = JSON.stringify({ v: 1, note, url: "https://explorer.test.mezo.org" });
  return { evidence, evidenceHash: hashText(evidence) };
}

async function waitTx(tx) {
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction failed: ${receipt?.hash}`);
  return receipt.hash;
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
  const borrower = await hre.ethers.getContractAt(
    [
      "function minNetDebt() view returns (uint256)",
      "function getBorrowingFee(uint256) view returns (uint256)",
      "function adjustTrove(uint256,uint256,bool,address,address) payable",
      "function withdrawMUSD(uint256,address,address)",
    ],
    BORROWER,
  );
  const trove = await hre.ethers.getContractAt(
    [
      "function getTroveStatus(address) view returns (uint8)",
      "function getTroveColl(address) view returns (uint256)",
      "function getTroveDebt(address) view returns (uint256)",
    ],
    TROVE_MANAGER,
  );
  const hints = await hre.ethers.getContractAt(
    ["function getApproxHint(uint256,uint256,uint256) view returns (address,uint256,uint256)"],
    HINTS,
  );
  const sorted = await hre.ethers.getContractAt(
    ["function findInsertPosition(uint256,address,address) view returns (address,address)"],
    SORTED,
  );
  const priceFeed = await hre.ethers.getContractAt(["function fetchPrice() view returns (uint256)"], PRICE);
  const pool = await hre.ethers.getContractAt(["function provideToSP(uint256)"], POOL);

  const evidence = { borrow: null, release: null, refund: null, split: null, stability: null };
  const net = hre.ethers.parseEther("20");
  const price = await priceFeed.fetchPrice();
  const coll = await trove.getTroveColl(seller.address);
  const debt = await trove.getTroveDebt(seller.address);
  const status = await trove.getTroveStatus(seller.address);
  const borrowFee = await borrower.getBorrowingFee(net);
  const totalDebt = debt + net + borrowFee;
  const needed = (totalDebt * 150n * 10n ** 16n + price - 1n) / price;
  const extra = needed > coll ? needed - coll : 0n;
  const balance = await hre.ethers.provider.getBalance(seller.address);
  if (status === 1n && balance > extra + hre.ethers.parseEther("0.003")) {
    try {
      const nicr = ((coll + extra) * 10n ** 20n) / totalDebt;
      const approx = await hints.getApproxHint(nicr, 15, 42);
      const position = await sorted.findInsertPosition(nicr, approx[0], approx[0]);
      if (extra === 0n) {
        evidence.borrow = await waitTx(await borrower.withdrawMUSD(net, position[0], position[1]));
      } else {
        evidence.borrow = await waitTx(await borrower.adjustTrove(0, net, true, position[0], position[1], { value: extra }));
      }
    } catch (error) {
      evidence.borrow = { failed: error instanceof Error ? error.message : String(error) };
    }
  } else {
    evidence.borrow = { skipped: true, status: status.toString(), balance: balance.toString(), extra: extra.toString() };
  }

  const gas = hre.ethers.parseEther("0.002");
  await waitTx(await seller.sendTransaction({ to: buyer.address, value: gas }));
  await waitTx(await seller.sendTransaction({ to: resolver.address, value: gas }));
  const stake = hre.ethers.parseEther("40");
  await waitTx(await musd.transfer(buyer.address, stake));

  async function create(title, fundingIn, deliveryAfter) {
    const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
    const fundingDeadline = now + fundingIn;
    const deliveryDeadline = fundingDeadline + deliveryAfter;
    const meta = buildMeta(title);
    const tx = await escrow.createEscrow(
      buyer.address,
      resolver.address,
      hre.ethers.parseEther("10"),
      fundingDeadline,
      deliveryDeadline,
      15 * 60,
      meta.termsHash,
      meta.metadataHash,
      meta.metadata,
    );
    const receipt = await tx.wait();
    const parsed = receipt.logs.map((log) => { try { return escrow.interface.parseLog(log); } catch { return null; } }).find((log) => log?.name === "EscrowCreated");
    return { id: parsed.args.escrowId, deliveryDeadline };
  }

  async function fund(id) {
    const amount = hre.ethers.parseEther("10");
    await waitTx(await musd.connect(buyer).approve(ESCROW, amount));
    await waitTx(await escrow.connect(buyer).fundEscrow(id));
  }

  const releaseId = await create("Wave 2 release", 2 * DAY, DAY);
  await fund(releaseId.id);
  const releaseEvidence = buildEvidence("Release evidence");
  await waitTx(await escrow.connect(seller).submitDelivery(releaseId.id, releaseEvidence.evidenceHash, releaseEvidence.evidence));
  evidence.release = await waitTx(await escrow.connect(buyer).releaseToSeller(releaseId.id));

  const splitId = await create("Wave 2 split", 2 * DAY, DAY);
  await fund(splitId.id);
  const splitEvidence = buildEvidence("Split evidence");
  await waitTx(await escrow.connect(seller).submitDelivery(splitId.id, splitEvidence.evidenceHash, splitEvidence.evidence));
  const reason = "Split this evidence payment.";
  await waitTx(await escrow.connect(buyer).raiseDispute(splitId.id, hashText(reason), reason));
  evidence.split = await waitTx(await escrow.connect(resolver).resolveDisputeSplit(splitId.id, hre.ethers.parseEther("4")));

  const reserve = hre.ethers.parseEther("1");
  await waitTx(await musd.approve(POOL, reserve));
  evidence.stability = await waitTx(await pool.provideToSP(reserve));

  const refundId = await create("Wave 2 refund", 90, HOUR);
  await fund(refundId.id);
  const refundAt = Number(refundId.deliveryDeadline) + 2;
  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const waitMs = Math.max(0, (refundAt - now) * 1000);
  console.log(`Waiting ${Math.ceil(waitMs / 1000)}s for the refund deadline.`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  evidence.refund = await waitTx(await escrow.connect(buyer).refundAfterMissedDeadline(refundId.id));

  const record = {
    escrow: ESCROW,
    seller: seller.address,
    buyer: buyer.address,
    resolver: resolver.address,
    ...evidence,
    recordedAt: new Date().toISOString(),
  };
  const file = path.join(process.cwd(), "deployments", "wave2-evidence.json");
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
