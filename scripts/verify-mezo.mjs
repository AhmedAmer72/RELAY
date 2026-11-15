import { createPublicClient, http, parseAbi } from "viem";

const rpc = process.env.MEZO_TESTNET_RPC_URL || "https://rpc.test.mezo.org";
const client = createPublicClient({
  transport: http(rpc, { fetchOptions: { headers: { "user-agent": "RELAY verify-mezo" } } }),
});

const musd = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const current = "0x7b31489D0da4b745E26689647FC1514071De3fD4";
const escrows = [
  ["current", current],
  ["prior-50ab", "0x50ab19e57dff6f2De6e8f3A17EF96417f39cB793"],
  ["prior-e881", "0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F"],
  ["prior-2253", "0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46"],
  ["prior-1bf7", "0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087"],
  ["prior-cf6a", "0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125"],
];
const system = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  stabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  skipBtcUsd: "0x7b7c000000000000000000000000000000000015",
  basicRouter: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
  basicFactory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
  musdBtcPool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
  mainnetRouterOnTestnet: "0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706",
};

const erc20 = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);
const feeAbi = parseAbi(["function feeBps() view returns (uint256)"]);
const feedAbi = parseAbi(["function fetchPrice() view returns (uint256)"]);
const troveAbi = parseAbi([
  "function MCR() view returns (uint256)",
  "function CCR() view returns (uint256)",
  "function getTCR(uint256 price) view returns (uint256)",
]);
const skipAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);
const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);

async function bytecodeBytes(address) {
  const code = await client.getBytecode({ address });
  return code && code !== "0x" ? (code.length - 2) / 2 : 0;
}

async function feeBps(address) {
  try {
    return (await client.readContract({ address, abi: feeAbi, functionName: "feeBps" })).toString();
  } catch {
    return null;
  }
}

const chainId = await client.getChainId();
const [name, symbol, decimals] = await Promise.all([
  client.readContract({ address: musd, abi: erc20, functionName: "name" }),
  client.readContract({ address: musd, abi: erc20, functionName: "symbol" }),
  client.readContract({ address: musd, abi: erc20, functionName: "decimals" }),
]);
const escrowFees = [];
for (const [label, address] of escrows) {
  escrowFees.push({ label, address, bytecodeBytes: await bytecodeBytes(address), feeBps: await feeBps(address) });
}
const price = await client.readContract({ address: system.priceFeed, abi: feedAbi, functionName: "fetchPrice" });
const [mcr, ccr, tcr] = await Promise.all([
  client.readContract({ address: system.troveManager, abi: troveAbi, functionName: "MCR" }),
  client.readContract({ address: system.troveManager, abi: troveAbi, functionName: "CCR" }),
  client.readContract({ address: system.troveManager, abi: troveAbi, functionName: "getTCR", args: [price] }),
]);
const skip = await client.readContract({ address: system.skipBtcUsd, abi: skipAbi, functionName: "latestRoundData" });
const reserves = await client.readContract({ address: system.musdBtcPool, abi: pairAbi, functionName: "getReserves" });
const [token0, token1] = await Promise.all([
  client.readContract({ address: system.musdBtcPool, abi: pairAbi, functionName: "token0" }),
  client.readContract({ address: system.musdBtcPool, abi: pairAbi, functionName: "token1" }),
]);
const now = BigInt(Math.floor(Date.now() / 1000));
const report = {
  chainId,
  musd: { address: musd, name, symbol, decimals, bytecodeBytes: await bytecodeBytes(musd) },
  escrows: escrowFees,
  system: Object.fromEntries(await Promise.all(Object.entries(system).map(async ([key, address]) => [key, { address, bytecodeBytes: await bytecodeBytes(address) }]))),
  oracle: {
    priceFeed: price.toString(),
    skipAnswer: skip[1].toString(),
    skipUpdatedAt: skip[3].toString(),
    skipAgeSeconds: (now - skip[3]).toString(),
    mcr: mcr.toString(),
    ccr: ccr.toString(),
    tcr: tcr.toString(),
    recoveryMode: tcr < ccr,
  },
  pool: {
    token0,
    token1,
    reserve0: reserves[0].toString(),
    reserve1: reserves[1].toString(),
  },
};

let sourcify = "unread";
try {
  const response = await fetch(`https://sourcify.dev/server/v2/contract/31611/${current}`);
  sourcify = response.ok ? await response.json() : { status: response.status };
} catch (error) {
  sourcify = { error: error instanceof Error ? error.message : "fetch failed" };
}
report.sourcify = sourcify;
console.log(JSON.stringify(report, null, 2));

const feeOk = escrowFees.filter((item) => ["current", "prior-50ab", "prior-e881"].includes(item.label)).every((item) => item.feeBps === "50");
const freeOk = escrowFees.filter((item) => ["prior-2253", "prior-1bf7", "prior-cf6a"].includes(item.label)).every((item) => item.feeBps === null);
const sourcifyOk = report.sourcify?.match === "exact_match" && report.sourcify?.runtimeMatch === "exact_match";
if (chainId !== 31611 || symbol !== "MUSD" || decimals !== 18 || !feeOk || !freeOk || price === 0n || reserves[0] === 0n || reserves[1] === 0n || !sourcifyOk) {
  process.exit(1);
}
