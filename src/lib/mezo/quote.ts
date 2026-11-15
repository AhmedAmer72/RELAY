import { GAS_RESERVE, LIQUIDATION_ICR, MIN_ICR } from "@/lib/mezo/system";

export function collateralForIcr(totalDebt: bigint, price: bigint, icr = MIN_ICR) {
  if (price === 0n || totalDebt === 0n) return 0n;
  const numerator = totalDebt * icr;
  return (numerator + price - 1n) / price;
}

export function collateralRatio(coll: bigint, debt: bigint, price: bigint) {
  if (debt === 0n || price === 0n) return undefined;
  return (coll * price) / debt;
}

export function liquidationPrice(coll: bigint, debt: bigint) {
  if (coll === 0n) return undefined;
  return (debt * LIQUIDATION_ICR) / coll;
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
