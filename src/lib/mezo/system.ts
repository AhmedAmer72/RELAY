import { getAddress } from "viem";

/** Mezo Testnet proxies. Addresses match mezo-org/musd matsnet deployments and the MUSD docs. */
export const MEZO_TESTNET_SYSTEM = {
  borrowerOperations: getAddress("0xCdF7028ceAB81fA0C6971208e83fa7872994beE5"),
  troveManager: getAddress("0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0"),
  hintHelpers: getAddress("0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6"),
  sortedTroves: getAddress("0x722E4D24FD6Ff8b0AC679450F3D91294607268fA"),
  priceFeed: getAddress("0x86bCF0841622a5dAC14A313a15f96A95421b9366"),
  stabilityPool: getAddress("0x1CCA7E410eE41739792eA0A24e00349Dd247680e"),
} as const;

export const borrowerOperationsAbi = [
  { type: "function", name: "minNetDebt", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getBorrowingFee", stateMutability: "view", inputs: [{ name: "_debt", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "openTrove", stateMutability: "payable", inputs: [
    { name: "_debtAmount", type: "uint256" },
    { name: "_upperHint", type: "address" },
    { name: "_lowerHint", type: "address" },
  ], outputs: [] },
  { type: "function", name: "withdrawMUSD", stateMutability: "nonpayable", inputs: [
    { name: "_amount", type: "uint256" },
    { name: "_upperHint", type: "address" },
    { name: "_lowerHint", type: "address" },
  ], outputs: [] },
  { type: "function", name: "adjustTrove", stateMutability: "payable", inputs: [
    { name: "_collWithdrawal", type: "uint256" },
    { name: "_debtChange", type: "uint256" },
    { name: "_isDebtIncrease", type: "bool" },
    { name: "_upperHint", type: "address" },
    { name: "_lowerHint", type: "address" },
  ], outputs: [] },
  { type: "function", name: "repayMUSD", stateMutability: "nonpayable", inputs: [
    { name: "_amount", type: "uint256" },
    { name: "_upperHint", type: "address" },
    { name: "_lowerHint", type: "address" },
  ], outputs: [] },
  { type: "function", name: "closeTrove", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const troveManagerAbi = [
  { type: "function", name: "MUSD_GAS_COMPENSATION", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveStatus", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "getTroveColl", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveDebt", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getCurrentICR", stateMutability: "view", inputs: [
    { name: "_borrower", type: "address" },
    { name: "_price", type: "uint256" },
  ], outputs: [{ type: "uint256" }] },
] as const;

export const hintHelpersAbi = [
  { type: "function", name: "getApproxHint", stateMutability: "view", inputs: [
    { name: "_CR", type: "uint256" },
    { name: "_numTrials", type: "uint256" },
    { name: "_inputRandomSeed", type: "uint256" },
  ], outputs: [
    { name: "hintAddress", type: "address" },
    { name: "diff", type: "uint256" },
    { name: "latestRandomSeed", type: "uint256" },
  ] },
] as const;

export const sortedTrovesAbi = [
  { type: "function", name: "findInsertPosition", stateMutability: "view", inputs: [
    { name: "_NICR", type: "uint256" },
    { name: "_prevId", type: "address" },
    { name: "_nextId", type: "address" },
  ], outputs: [{ type: "address" }, { type: "address" }] },
] as const;

export const priceFeedAbi = [
  { type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const stabilityPoolAbi = [
  { type: "function", name: "provideToSP", stateMutability: "nonpayable", inputs: [{ name: "_amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdrawFromSP", stateMutability: "nonpayable", inputs: [{ name: "_amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "getCompoundedMUSDDeposit", stateMutability: "view", inputs: [{ name: "_depositor", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getDepositorCollateralGain", stateMutability: "view", inputs: [{ name: "_depositor", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdrawCollateralGainToTrove", stateMutability: "nonpayable", inputs: [
    { name: "_upperHint", type: "address" },
    { name: "_lowerHint", type: "address" },
  ], outputs: [] },
] as const;

export const TROVE_ACTIVE = 1;
export const MIN_ICR = 150n * 10n ** 16n;
export const LIQUIDATION_ICR = 110n * 10n ** 16n;
export const GAS_RESERVE = 10n ** 15n;
