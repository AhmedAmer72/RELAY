import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import type { FacilitatorClient } from "@x402/core/server";
import { VERIFIED_TESTNET } from "@/lib/chain/config";
import { X402_SCHEME } from "@/lib/x402/instant";
import { classifySettlement, paymentCalls } from "@/lib/x402/payment";

const merchant = getAddress("0x00000000000000000000000000000000000000a1");

function facilitator(): FacilitatorClient {
  return {
    getSupported: async () => ({
      kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:31611" }],
      extensions: [],
      signers: {},
    }),
    verify: async () => ({ isValid: false, invalidReason: "missing" }),
    settle: async () => { throw new Error("This test does not settle."); },
  };
}

describe("official x402 stays off the escrow", () => {
  it("refuses a missing merchant and the escrow address", async () => {
    const { payToProblem } = await import("@/lib/x402/instant");
    expect(payToProblem(undefined)).toMatch(/does not fund RelayEscrow/);
    expect(payToProblem(VERIFIED_TESTNET.escrow)).toMatch(/does not fund/);
    expect(payToProblem(merchant)).toBeUndefined();
  });

  it("returns an unpaid exact-scheme 402 from a mocked facilitator", async () => {
    const { instantHttpResponse, instantPaymentResult, X402_NETWORK, X402_SCHEME: scheme } = await import("@/lib/x402/instant");
    const request = new Request("http://127.0.0.1/api/x402/instant", { headers: { accept: "application/json" } });
    const result = await instantPaymentResult(request, merchant, facilitator());
    expect(result.type).toBe("payment-error");
    if (result.type !== "payment-error") return;
    expect(result.response.status).toBe(402);
    const response = instantHttpResponse(result);
    expect(response.status).toBe(402);
    const body = await response.json() as { accepts?: Array<{ scheme?: string; network?: string; payTo?: string }> };
    const accept = body.accepts?.[0];
    expect(accept?.scheme ?? scheme).toBe("exact");
    expect(X402_NETWORK).toBe("eip155:31611");
    expect(accept?.payTo?.toLowerCase()).not.toBe(VERIFIED_TESTNET.escrow.toLowerCase());
  });

  it("keeps agreement settlement on fundEscrow rather than a token transfer", () => {
    const escrow = getAddress("0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46");
    const musd = VERIFIED_TESTNET.musd;
    const calls = paymentCalls(escrow, musd, 1n, 10n ** 18n);
    expect(X402_SCHEME).toBe("exact");
    expect(classifySettlement(musd, "0xa9059cbb", escrow, musd, 1n, 10n ** 18n)).toBeNull();
    expect(classifySettlement(calls.fund.to, calls.fund.data, escrow, musd, 1n, 10n ** 18n)).toBe("fund");
  });
});
