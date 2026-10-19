import { createPublicClient, http } from "viem";

const address = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const client = createPublicClient({
  transport: http("https://rpc.test.mezo.org"),
});

const abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];

const [chainId, name, symbol, decimals, code] = await Promise.all([
  client.getChainId(),
  client.readContract({ address, abi, functionName: "name" }),
  client.readContract({ address, abi, functionName: "symbol" }),
  client.readContract({ address, abi, functionName: "decimals" }),
  client.getBytecode({ address }),
]);

const report = {
  chainId,
  address,
  name,
  symbol,
  decimals,
  bytecodeBytes: code ? (code.length - 2) / 2 : 0,
};
console.log(JSON.stringify(report, null, 2));
if (chainId !== 31611 || symbol !== "MUSD" || decimals !== 18 || !code || code === "0x") {
  process.exit(1);
}
