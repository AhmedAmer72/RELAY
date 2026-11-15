import { GAS_RESERVE, LIQUIDATION_ICR, MIN_ICR } from "@/lib/mezo/system";

export const ORACLE_MAX_AGE_SECONDS = 60n * 60n;
export const ORACLE_MAX_GAP_BPS = 200n;
export const RELAY_BORROW_FLOOR = MIN_ICR;

export function collateralForIcr(totalDebt: bigint, price: bigint, icr = MIN_ICR) {
  if (price === 0n || totalDebt === 0n) return 0n;
  const numerator = totalDebt * icr;
  return (numerator + price - 1n) / price;
}

export function collateralRatio(coll: bigint, debt: bigint, price: bigint) {
  if (debt === 0n || price === 0n) return undefined;
  return (coll * price) / debt;
}

export function liquidationPrice(coll: bigint, debt: bigint, mcr = LIQUIDATION_ICR) {
  if (coll === 0n || debt === 0n || mcr === 0n) return undefined;
  return (debt * mcr) / coll;
}

export function inRecoveryMode(tcr?: bigint, ccr?: bigint) {
  if (tcr === undefined || ccr === undefined) return undefined;
  return tcr < ccr;
}

export function priceGapBps(feed: bigint, skip: bigint) {
  if (feed <= 0n || skip <= 0n) return undefined;
  const diff = feed > skip ? feed - skip : skip - feed;
  return (diff * 10_000n) / feed;
}

export function oracleAllowsBorrow(input: { feed: bigint; skip: bigint; updatedAt: bigint; now: bigint }) {
  if (input.feed <= 0n || input.skip <= 0n) {
    return { ok: false as const, reason: "The BTC price is not available." };
  }
  if (input.updatedAt <= 0n || input.now > input.updatedAt + ORACLE_MAX_AGE_SECONDS) {
    return { ok: false as const, reason: "The BTC/USD oracle is more than an hour old." };
  }
  const gap = priceGapBps(input.feed, input.skip);
  if (gap === undefined || gap > ORACLE_MAX_GAP_BPS) {
    return { ok: false as const, reason: "The Mezo price and the Skip oracle differ by more than 2%." };
  }
  return { ok: true as const, gap };
}

export type BorrowPlan = {
  ok: boolean;
  mode: "open" | "withdraw" | "adjust";
  netMusd: bigint;
  collateral: bigint;
  totalDebt: bigint;
  ratio?: bigint;
  reason?: string;
};

export function planBorrow(input: {
  shortfall: bigint;
  minNetDebt: bigint;
  gasCompensation: bigint;
  borrowFee: bigint;
  price: bigint;
  nativeBalance: bigint;
  active: boolean;
  coll: bigint;
  debt: bigint;
}): BorrowPlan {
  if (input.shortfall <= 0n) {
    return { ok: false, mode: "withdraw", netMusd: 0n, collateral: 0n, totalDebt: input.debt, reason: "The MUSD balance covers this invoice." };
  }
  if (input.price === 0n) {
    return { ok: false, mode: "open", netMusd: 0n, collateral: 0n, totalDebt: 0n, reason: "The BTC price is not available." };
  }
  if (!input.active) {
    const netMusd = input.shortfall > input.minNetDebt ? input.shortfall : input.minNetDebt;
    const totalDebt = netMusd + input.borrowFee + input.gasCompensation;
    const collateral = collateralForIcr(totalDebt, input.price);
    const spendable = input.nativeBalance > GAS_RESERVE ? input.nativeBalance - GAS_RESERVE : 0n;
    if (collateral > spendable) {
      return { ok: false, mode: "open", netMusd, collateral, totalDebt, reason: "Not enough BTC collateral for a trove at 150%." };
    }
    return { ok: true, mode: "open", netMusd, collateral, totalDebt, ratio: collateralRatio(collateral, totalDebt, input.price) };
  }
  const netMusd = input.shortfall;
  const totalDebt = input.debt + netMusd + input.borrowFee;
  const ratio = collateralRatio(input.coll, totalDebt, input.price);
  if (ratio !== undefined && ratio >= MIN_ICR) {
    return { ok: true, mode: "withdraw", netMusd, collateral: 0n, totalDebt, ratio };
  }
  const needed = collateralForIcr(totalDebt, input.price);
  const extra = needed > input.coll ? needed - input.coll : 0n;
  const spendable = input.nativeBalance > GAS_RESERVE ? input.nativeBalance - GAS_RESERVE : 0n;
  if (extra > spendable) {
    return { ok: false, mode: "adjust", netMusd, collateral: extra, totalDebt, ratio, reason: "Borrowing the shortfall would put the trove under 150%." };
  }
  return { ok: true, mode: "adjust", netMusd, collateral: extra, totalDebt, ratio: collateralRatio(input.coll + extra, totalDebt, input.price) };
}
