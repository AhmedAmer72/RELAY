import { createPublicClient, createWalletClient, http, parseAbi, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { createPermit2ApprovalTx, registerExactEvmScheme } from "@x402/evm/exact/client";

const key = process.env.RELAY_LIVE_KEY;
const payTo = process.env.X402_PAY_TO;
const url = process.env.X402_URL || "http://127.0.0.1:3020/api/x402/instant";
if (!key || !payTo) {
  console.error("RELAY_LIVE_KEY and X402_PAY_TO are required.");
  process.exit(1);
}

const rpc = "https://rpc.test.mezo.org";
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const chain = {
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
};
const publicClient = createPublicClient({ chain, transport: http(rpc, { fetchOptions: { headers: { "user-agent": "RELAY" } } }) });
const wallet = createWalletClient({ account, chain, transport: http(rpc, { fetchOptions: { headers: { "user-agent": "RELAY" } } }) });

const musd = getAddress("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503");
const btc = getAddress("0x7b7C000000000000000000000000000000000000");
const borrower = getAddress("0xCdF7028ceAB81fA0C6971208e83fa7872994beE5");
const trove = getAddress("0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0");
const hints = getAddress("0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6");
const sorted = getAddress("0x722E4D24FD6Ff8b0AC679450F3D91294607268fA");
const feed = getAddress("0x86bCF0841622a5dAC14A313a15f96A95421b9366");
const pool = getAddress("0x1CCA7E410eE41739792eA0A24e00349Dd247680e");
const router = getAddress("0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9");
const factory = getAddress("0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A");
const escrow = getAddress("0x7b31489D0da4b745E26689647FC1514071De3fD4");

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const troveAbi = parseAbi([
  "function getTroveColl(address) view returns (uint256)",
  "function getTroveDebt(address) view returns (uint256)",
]);
const feedAbi = parseAbi(["function fetchPrice() view returns (uint256)"]);
const hintAbi = parseAbi(["function getApproxHint(uint256,uint256,uint256) view returns (address,uint256,uint256)"]);
const sortedAbi = parseAbi(["function findInsertPosition(uint256,address,address) view returns (address,address)"]);
const borrowAbi = parseAbi([
  "function repayMUSD(uint256,address,address)",
  "function withdrawMUSD(uint256,address,address)",
]);
const poolAbi = parseAbi([
  "function provideToSP(uint256)",
  "function withdrawFromSP(uint256)",
  "function getCompoundedMUSDDeposit(address) view returns (uint256)",
]);
const routerAbi = parseAbi([
  "function getAmountsOut(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[] amounts)",
]);

const evidence = { account: account.address, payTo, url };

async function gasLimit(request) {
  try {
    const estimated = await publicClient.estimateGas({ account: account.address, ...request });
    const padded = estimated + estimated / 3n;
    return padded < 400_000n ? 400_000n : padded;
  } catch {
    return 250_000n;
  }
}

async function send(name, request) {
  const gas = await gasLimit(request);
  const hash = await wallet.writeContract({ ...request, gas });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${name} reverted ${hash} gas ${receipt.gasUsed.toString()}/${gas.toString()}`);
  evidence[name] = hash;
  console.log(name, hash);
  return receipt;
}

async function hintsFor(coll, debt) {
  const nicr = coll * 10n ** 20n / debt;
  const approx = await publicClient.readContract({ address: hints, abi: hintAbi, functionName: "getApproxHint", args: [nicr, 15n, 42n] });
  const position = await publicClient.readContract({ address: sorted, abi: sortedAbi, functionName: "findInsertPosition", args: [nicr, approx[0], approx[0]] });
  return position;
}

async function ensureAllowance(token, spender, amount, name) {
  const current = await publicClient.readContract({ address: token, abi: erc20, functionName: "allowance", args: [account.address, spender] });
  if (current >= amount) return;
  await send(name, { address: token, abi: erc20, functionName: "approve", args: [spender, amount] });
}

async function payInstant() {
  if (getAddress(payTo) === escrow) throw new Error("Merchant is the escrow.");
  const approval = createPermit2ApprovalTx(musd);
  const approvalHash = await wallet.sendTransaction({ to: approval.to, data: approval.data, gas: 80_000n });
  const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  if (approvalReceipt.status !== "success") throw new Error(`Permit2 approval reverted ${approvalHash}`);
  evidence.permit2Approval = approvalHash;
  console.log("permit2Approval", approvalHash);
  const x402 = new x402Client();
  registerExactEvmScheme(x402, { signer: account, schemeOptions: { rpcUrl: rpc } });
  const httpClient = new x402HTTPClient(x402);
  const unpaid = await fetch(url, { headers: { accept: "text/html,application/json" } });
  const raw = await unpaid.text();
  evidence.unpaidStatus = unpaid.status;
  evidence.paywallHtml = raw.includes("<html") || raw.includes("<!DOCTYPE") || raw.includes("paywall");
  const body = raw.trim().startsWith("{") ? JSON.parse(raw) : undefined;
  if (unpaid.status !== 402) throw new Error(`Expected 402 before payment, got ${unpaid.status}: ${raw.slice(0, 240)}`);
  const required = httpClient.getPaymentRequiredResponse((name) => unpaid.headers.get(name), body);
  const payload = await httpClient.createPaymentPayload(required);
  const paid = await fetch(url, { headers: { ...httpClient.encodePaymentSignatureHeader(payload), accept: "application/json" } });
  const paidText = await paid.text();
  console.log("paid status", paid.status);
  const requiredAgain = paid.headers.get("payment-required");
  if (requiredAgain) {
    console.log("payment-required", Buffer.from(requiredAgain, "base64").toString("utf8").slice(0, 1500));
  }
  const paidBody = paidText.trim().startsWith("{") ? JSON.parse(paidText) : { raw: paidText.slice(0, 200) };
  const settled = httpClient.getPaymentSettleResponse((name) => paid.headers.get(name));
  evidence.paidStatus = paid.status;
  evidence.paidBody = paidBody;
  evidence.settlement = settled;
  if (paid.status !== 200 || paidBody.fundsEscrow !== false || !settled?.transaction) {
    throw new Error(`x402 settlement failed ${paid.status} ${JSON.stringify(paidBody).slice(0, 400)}`);
  }
  const merchantBal = await publicClient.readContract({ address: musd, abi: erc20, functionName: "balanceOf", args: [payTo] });
  evidence.merchantMusd = merchantBal.toString();
  console.log("x402", settled.transaction, "merchantMUSD", merchantBal.toString());
}

async function swapTiny() {
  const amountIn = 10n ** 13n;
  const route = [{ from: btc, to: musd, stable: false, factory }];
  const amounts = await publicClient.readContract({ address: router, abi: routerAbi, functionName: "getAmountsOut", args: [amountIn, route] });
  const quoted = amounts[amounts.length - 1];
  const minOut = quoted - (quoted * 50n) / 10_000n;
  if (minOut < 1n) throw new Error("Swap quote was empty.");
  const before = await publicClient.readContract({ address: musd, abi: erc20, functionName: "balanceOf", args: [account.address] });
  await ensureAllowance(btc, router, amountIn, "approveSwap");
  const block = await publicClient.getBlock();
  await send("swap", {
    address: router,
    abi: routerAbi,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, minOut, route, account.address, block.timestamp + 20n * 60n],
  });
  const after = await publicClient.readContract({ address: musd, abi: erc20, functionName: "balanceOf", args: [account.address] });
  evidence.musdBeforeSwap = before.toString();
  evidence.musdAfterSwap = after.toString();
  if (after <= before) throw new Error("Swap receipt succeeded but the MUSD balance did not increase.");
  console.log("swap balance", before.toString(), "->", after.toString());
}

async function stabilityRoundTrip() {
  const amount = 10n ** 18n;
  await ensureAllowance(musd, pool, amount, "approveStability");
  await send("stabilityDeposit", { address: pool, abi: poolAbi, functionName: "provideToSP", args: [amount] });
  const parked = await publicClient.readContract({ address: pool, abi: poolAbi, functionName: "getCompoundedMUSDDeposit", args: [account.address] });
  if (parked < amount) throw new Error(`Stability deposit read ${parked.toString()}`);
  await send("stabilityWithdraw", { address: pool, abi: poolAbi, functionName: "withdrawFromSP", args: [parked] });
  const left = await publicClient.readContract({ address: pool, abi: poolAbi, functionName: "getCompoundedMUSDDeposit", args: [account.address] });
  evidence.stabilityRemaining = left.toString();
  if (left !== 0n) throw new Error(`Stability deposit remains ${left.toString()}`);
}

async function borrowOneMusd() {
  const price = await publicClient.readContract({ address: feed, abi: feedAbi, functionName: "fetchPrice" });
  const coll = await publicClient.readContract({ address: trove, abi: troveAbi, functionName: "getTroveColl", args: [account.address] });
  const debt = await publicClient.readContract({ address: trove, abi: troveAbi, functionName: "getTroveDebt", args: [account.address] });
  const borrow = 10n ** 18n;
  const position = await hintsFor(coll, debt + borrow);
  const before = await publicClient.readContract({ address: musd, abi: erc20, functionName: "balanceOf", args: [account.address] });
  await send("borrow", { address: borrower, abi: borrowAbi, functionName: "withdrawMUSD", args: [borrow, position[0], position[1]] });
  const after = await publicClient.readContract({ address: musd, abi: erc20, functionName: "balanceOf", args: [account.address] });
  const debtAfter = await publicClient.readContract({ address: trove, abi: troveAbi, functionName: "getTroveDebt", args: [account.address] });
  evidence.musdBeforeBorrow = before.toString();
  evidence.musdAfterBorrow = after.toString();
  evidence.icrAfter = (coll * price / debtAfter).toString();
  if (after <= before) throw new Error("Borrow receipt succeeded but the MUSD balance did not increase.");
  console.log("borrow balance", before.toString(), "->", after.toString());
}

if (process.env.SKIP_X402 === "1") console.log("skip x402");
else await payInstant();
await swapTiny();
await stabilityRoundTrip();
await borrowOneMusd();
console.log(JSON.stringify(evidence, null, 2));
