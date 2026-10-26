import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { classifySettlement, paymentCalls } from "@/lib/x402/payment";

const escrow = getAddress("0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46");
const musd = getAddress("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503");
const other = getAddress("0x0000000000000000000000000000000000000001");
const id = 4n;
const amount = 50n * 10n ** 18n;

describe("x402 settlement calls", () => {
  const calls = paymentCalls(escrow, musd, id, amount);

  it("accepts the exact approve and fund calls for this invoice", () => {
    expect(classifySettlement(calls.approve.to, calls.approve.data, escrow, musd, id, amount)).toBe("approve");
    expect(classifySettlement(calls.fund.to, calls.fund.data, escrow, musd, id, amount)).toBe("fund");
    expect(classifySettlement(calls.fundAsAgent.to, calls.fundAsAgent.data, escrow, musd, id, amount)).toBe("agent");
  });

  it("rejects a direct transfer and a fund call for a different agreement", () => {
    expect(classifySettlement(escrow, "0x", escrow, musd, id, amount)).toBeNull();
    expect(classifySettlement(other, calls.fund.data, escrow, musd, id, amount)).toBeNull();
    const otherInvoice = paymentCalls(escrow, musd, 9n, amount);
    expect(classifySettlement(otherInvoice.fund.to, otherInvoice.fund.data, escrow, musd, id, amount)).toBeNull();
  });
});
