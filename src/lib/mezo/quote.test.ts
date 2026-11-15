import { describe, expect, it } from "vitest";
import { collateralForIcr, liquidationPrice, oracleAllowsBorrow, planBorrow, priceGapBps } from "@/lib/mezo/quote";
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

  it("projects the ratio after a withdraw and prices liquidation from MCR", () => {
    const plan = planBorrow({
      shortfall: 10n * 10n ** 18n,
      minNetDebt: 1800n * 10n ** 18n,
      gasCompensation: 200n * 10n ** 18n,
      borrowFee: 0n,
      price,
      nativeBalance: 10n ** 18n,
      active: true,
      coll: 10n ** 18n,
      debt: 2000n * 10n ** 18n,
    });
    expect(plan.ok).toBe(true);
    expect(plan.ratio).toBe((10n ** 18n * price) / (2010n * 10n ** 18n));
    const mcr = 110n * 10n ** 16n;
    expect(liquidationPrice(10n ** 18n, 2010n * 10n ** 18n, mcr)).toBe((2010n * 10n ** 18n * mcr) / 10n ** 18n);
  });

  it("blocks a stale oracle and a price gap above 2%", () => {
    const now = 1_700_000_000n;
    expect(oracleAllowsBorrow({ feed: price, skip: price, updatedAt: now - 3601n, now }).ok).toBe(false);
    const far = price + (price * 201n) / 10_000n;
    expect(priceGapBps(price, far)).toBeGreaterThan(200n);
    expect(oracleAllowsBorrow({ feed: price, skip: far, updatedAt: now, now }).reason).toMatch(/2%/);
    expect(oracleAllowsBorrow({ feed: price, skip: price, updatedAt: now, now }).ok).toBe(true);
  });
});
