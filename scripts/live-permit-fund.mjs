import { createPublicClient, createWalletClient, http, webSocket, parseAbi, encodeFunctionData, getAddress, keccak256, toBytes } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const key = process.env.RELAY_LIVE_KEY;
if (!key) {
  console.error("RELAY_LIVE_KEY is required.");
  process.exit(1);
}
const rpc = "https://rpc.test.mezo.org";
const chain = { id: 31611, name: "Mezo Testnet", nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } };
const buyer = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const seller = privateKeyToAccount(generatePrivateKey());
const resolver = getAddress("0x0000000000000000000000000000000000000001");
const publicClient = createPublicClient({ chain, transport: http(rpc, { fetchOptions: { headers: { "user-agent": "RELAY" } } }) });
const buyerWallet = createWalletClient({ account: buyer, chain, transport: http(rpc, { fetchOptions: { headers: { "user-agent": "RELAY" } } }) });
const sellerWallet = createWalletClient({ account: seller, chain, transport: http(rpc, { fetchOptions: { headers: { "user-agent": "RELAY" } } }) });

const escrow = getAddress("0x069eef42fb0BaffFfFdCd7755e6e21E37299365d");
const musd = getAddress("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503");
const permit2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
const pool = getAddress("0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9");
const voter = getAddress("0x72F8dd7F44fFa19E45955aa20A5486E8EB255738");
const amount = 10n ** 18n;
const gas = 500_000n;

const erc20 = parseAbi(["function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)", "function balanceOf(address) view returns (uint256)"]);
const escrowAbi = parseAbi([
  "function createEscrow(address,address,uint256,uint64,uint64,uint32,bytes32,bytes32,string,uint256,uint256) returns (uint256)",
  "function acceptResolver(uint256)",
  "function fundWithPermit2(uint256,((address,uint160,uint48,uint48),address,uint256),bytes)",
  "function getEscrow(uint256) view returns (uint8,address,address,address,uint256,uint64,uint64,uint64,uint32,bytes32,bytes32)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed seller, address indexed buyer, address resolver, uint256 amount, uint64 fundingDeadline, uint64 deliveryDeadline, uint32 reviewPeriod, bytes32 termsHash, bytes32 metadataHash)",
]);
const permitAbi = parseAbi(["function allowance(address,address,address) view returns (uint160,uint48,uint48)"]);
const gaugeAbi = parseAbi(["function gauges(address) view returns (address)"]);

async function send(wallet, request) {
  const hash = await wallet.sendTransaction({ ...request, gas });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`reverted ${hash}`);
  return receipt;
}

const fundSeller = await send(buyerWallet, { to: seller.address, value: 300_000_000_000_000n });
console.log("fundSeller", fundSeller.transactionHash);

const now = BigInt((await publicClient.getBlock()).timestamp);
const funding = now + 2n * 24n * 60n * 60n;
const delivery = funding + 2n * 24n * 60n * 60n;
const terms = "Permit2 funding proof.";
const termsHash = keccak256(toBytes(terms));
const metadata = JSON.stringify({ v: 1, title: "Permit2 proof", description: "One confirmation.", terms, termsHash });
const metadataHash = keccak256(toBytes(metadata));
const created = await send(sellerWallet, {
  to: escrow,
  data: encodeFunctionData({
    abi: escrowAbi,
    functionName: "createEscrow",
    args: [buyer.address, resolver, amount, funding, delivery, 3600, termsHash, metadataHash, metadata, 0n, 0n],
  }),
});
const createdLog = created.logs.map((log) => {
  try { return publicClient ? null : null; } catch { return null; }
});
void createdLog;
const decoded = created.logs.find((log) => log.address.toLowerCase() === escrow.toLowerCase());
if (!decoded) throw new Error("No creation log.");
const { decodeEventLog } = await import("viem");
const event = decodeEventLog({ abi: escrowAbi, data: decoded.data, topics: decoded.topics });
const escrowId = event.args.escrowId;
console.log("created", created.transactionHash, escrowId.toString());

const accepted = await send(buyerWallet, { to: escrow, data: encodeFunctionData({ abi: escrowAbi, functionName: "acceptResolver", args: [escrowId] }) });
console.log("accept", accepted.transactionHash);

const allowance = await publicClient.readContract({ address: musd, abi: erc20, functionName: "allowance", args: [buyer.address, permit2] });
if (allowance < amount) {
  const approved = await send(buyerWallet, { to: musd, data: encodeFunctionData({ abi: erc20, functionName: "approve", args: [permit2, 2n ** 256n - 1n] }) });
  console.log("permit2Token", approved.transactionHash);
}
const slot = await publicClient.readContract({ address: permit2, abi: permitAbi, functionName: "allowance", args: [buyer.address, musd, escrow] });
const sigDeadline = now + 3600n;
const signature = await buyer.signTypedData({
  domain: { name: "Permit2", chainId: 31611, verifyingContract: permit2 },
  types: {
    PermitSingle: [
      { name: "details", type: "PermitDetails" },
      { name: "spender", type: "address" },
      { name: "sigDeadline", type: "uint256" },
    ],
    PermitDetails: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  primaryType: "PermitSingle",
  message: {
    details: { token: musd, amount, expiration: Number(sigDeadline), nonce: Number(slot[2]) },
    spender: escrow,
    sigDeadline,
  },
});
const funded = await send(buyerWallet, {
  to: escrow,
  data: encodeFunctionData({
    abi: escrowAbi,
    functionName: "fundWithPermit2",
    args: [escrowId, [[musd, amount, Number(sigDeadline), Number(slot[2])], escrow, sigDeadline], signature],
  }),
});
const stored = await publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "getEscrow", args: [escrowId] });
if (Number(stored[0]) !== 1) throw new Error(`Expected funded state, got ${stored[0].toString()}`);
console.log("funded", funded.transactionHash, "state", stored[0].toString());

const lp = await publicClient.readContract({ address: pool, abi: erc20, functionName: "balanceOf", args: [buyer.address] });
let gauge = "unread";
try {
  gauge = await publicClient.readContract({ address: voter, abi: gaugeAbi, functionName: "gauges", args: [pool] });
} catch (error) {
  gauge = error.shortMessage || "no gauge read";
}
const head = await createPublicClient({ chain, transport: webSocket("wss://rpc-ws.test.mezo.org") }).getBlockNumber();
console.log(JSON.stringify({ escrowId: escrowId.toString(), lp: lp.toString(), gauge: String(gauge), websocketHead: head.toString() }, null, 2));
