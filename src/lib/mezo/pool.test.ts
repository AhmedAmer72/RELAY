import { describe, expect, it } from "vitest";
import { DELEGATED_TROVE } from "@/lib/mezo/delegated-trove";
import { minimumOut, suggestBtcIn } from "@/lib/mezo/pool";

describe("swap minimum", () => {
  it("rejects a zero quote and a 100% slippage setting", () => {
    expect(minimumOut(0n)).toBeUndefined();
    expect(minimumOut(1_000n, 10_000n)).toBeUndefined();
    expect(minimumOut(1n)).toBe(1n);
  });

  it("keeps at least one base unit after 0.50% slippage", () => {
    const quoted = 1_000n * 10n ** 18n;
    const min = minimumOut(quoted);
    expect(min).toBe(quoted - (quoted * 50n) / 10_000n);
    expect(min! >= 1n).toBe(true);
  });

  it("suggests a BTC input that stays inside the reserves", () => {
    const input = suggestBtcIn(100n * 10n ** 18n, 1_000_000n * 10n ** 18n, 10n * 10n ** 18n);
    expect(input).toBeGreaterThan(0n);
    expect(suggestBtcIn(1_000_000n * 10n ** 18n, 1_000_000n * 10n ** 18n, 10n * 10n ** 18n)).toBeUndefined();
  });
});

describe("delegated trove", () => {
  it("stays refused because the signed recipient is not the borrower", () => {
    expect(DELEGATED_TROVE.status).toBe("refused");
    expect(DELEGATED_TROVE.reason).toMatch(/recipient/);
  });
});
