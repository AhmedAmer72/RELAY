const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId === 31612) {
    throw new Error("Mainnet deployment is disabled.");
  }
  if (chainId !== 31611) {
    throw new Error(`Refusing to deploy. Expected Mezo Testnet chain id 31611, received ${chainId}.`);
  }

  const musd = process.env.MUSD_ADDRESS || process.env.NEXT_PUBLIC_MUSD_TESTNET_ADDRESS;
  if (!musd) {
    throw new Error("Set MUSD_ADDRESS to the verified Mezo Testnet MUSD token.");
  }

  const code = await hre.ethers.provider.getCode(musd);
  if (!code || code === "0x") {
    throw new Error(`No contract code at MUSD address ${musd}.`);
  }

  const token = await hre.ethers.getContractAt(
    [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ],
    musd,
  );
  const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
  if (symbol !== "MUSD" || Number(decimals) !== 18) {
    throw new Error(`Refusing to deploy against unexpected token ${name} ${symbol} decimals=${decimals}.`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory("RelayEscrow");
  const escrow = await factory.deploy(musd, deployer.address);
  const deployment = escrow.deploymentTransaction();
  await escrow.waitForDeployment();
  const address = await escrow.getAddress();
  const receipt = await deployment.wait();
  const configured = await escrow.musdToken();
  if (configured.toLowerCase() !== musd.toLowerCase()) {
    throw new Error("Deployed contract token address does not match the requested MUSD address.");
  }
  const partialSettlement = await escrow.partialSettlementSupported();
  const mutualCancel = await escrow.mutualCancelSupported();
  const deliveryAgents = await escrow.deliveryAgentSupported();
  const agentProbe = await escrow.agentAllowance(hre.ethers.ZeroAddress, hre.ethers.ZeroAddress);
  const feeBps = await escrow.feeBps();
  const feeRecipient = await escrow.feeRecipient();
  const milestoneGate = await escrow.milestoneGateSupported();
  const resolverAcceptance = await escrow.resolverAcceptanceSupported();
  const reviewExtension = await escrow.reviewExtensionSupported();
  const resolverFee = await escrow.resolverFeeSupported();
  if (partialSettlement !== true || mutualCancel !== true || deliveryAgents !== true || milestoneGate !== true || resolverAcceptance !== true || reviewExtension !== true || resolverFee !== true || agentProbe !== 0n || feeBps !== 50n || feeRecipient.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Deployed contract is missing a required rule.");
  }

  const record = {
    product: "RELAY",
    contract: "RelayEscrow",
    network: "mezo-testnet",
    chainId,
    address,
    musd,
    musdName: name,
    musdSymbol: symbol,
    musdDecimals: Number(decimals),
    partialSettlement: true,
    mutualCancel: true,
    deliveryAgents: true,
    milestoneGate: true,
    resolverAcceptance: true,
    reviewExtension: true,
    resolverFee: true,
    agentBudgets: true,
    feeBps: Number(feeBps),
    feeRecipient,
    deployer: receipt.from,
    deployTx: receipt.hash,
    blockNumber: receipt.blockNumber,
    compiler: "0.8.28",
    evmVersion: "london",
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    deployedAt: new Date().toISOString(),
    explorerAddress: `https://explorer.test.mezo.org/address/${address}`,
    explorerTx: `https://explorer.test.mezo.org/tx/${receipt.hash}`,
  };

  const dir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const currentPath = path.join(dir, "mezo-testnet.json");
  if (fs.existsSync(currentPath)) {
    const previous = JSON.parse(fs.readFileSync(currentPath, "utf8"));
    if (previous.address && previous.address.toLowerCase() !== address.toLowerCase()) {
      fs.writeFileSync(path.join(dir, "mezo-testnet-v5.json"), JSON.stringify(previous, null, 2) + "\n");
    }
  }
  fs.writeFileSync(currentPath, JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify(record, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
