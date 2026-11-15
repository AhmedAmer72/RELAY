import { describe, expect, it } from "vitest";
import { collateralForIcr, planBorrow } from "@/lib/mezo/quote";
import { MIN_ICR } from "@/lib/mezo/system";

const price = 75_939n * 10n ** 18n;

describe("borrow quote", () => {
  it("opens at least the minimum debt and keeps 150% collateral", () => {
    const minNetDebt = 1800n * 10n ** 18n;
    const gasCompensation = 200n * 10n ** 18n;
    const borrowFee = 18n * 10n ** 17n;
    const plan = planBorrow({
      shortfall: 50n * 10n ** 18n,
      minNetDebt,
      gasCompensation,
      borrowFee,
      price,
      nativeBalance: 10n ** 18n,
      active: false,
      coll: 0n,
      debt: 0n,
    });
    expect(plan.ok).toBe(true);
    expect(plan.mode).toBe("open");
    expect(plan.netMusd).toBe(minNetDebt);
    const ratio = (plan.collateral * price) / plan.totalDebt;
    expect(ratio >= MIN_ICR).toBe(true);
    expect(plan.collateral).toBe(collateralForIcr(plan.totalDebt, price));
  });

  it("refuses a new trove when the wallet cannot post the collateral", () => {
    const plan = planBorrow({
      shortfall: 50n * 10n ** 18n,
      minNetDebt: 1800n * 10n ** 18n,
      gasCompensation: 200n * 10n ** 18n,
      borrowFee: 18n * 10n ** 17n,
      price,
      nativeBalance: 10n ** 15n,
      active: false,
      coll: 0n,
      debt: 0n,
    });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/Not enough BTC/);
  });
});
