import { getAddress } from "viem";
import { getEscrowConfig } from "@/lib/chain/config";
import { instantHttpResponse, instantPaymentResult, payToProblem, X402_NETWORK, X402_SCHEME } from "@/lib/x402/instant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const escrow = getEscrowConfig().address;
  const problem = payToProblem(process.env.X402_PAY_TO, escrow);
  if (problem) {
    return Response.json({
      product: "RELAY",
      scheme: X402_SCHEME,
      network: X402_NETWORK,
      fundsEscrow: false,
      error: problem,
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  try {
    const result = await instantPaymentResult(request, getAddress(process.env.X402_PAY_TO!));
    return instantHttpResponse(result);
  } catch (error) {
    return Response.json({
      product: "RELAY",
      scheme: X402_SCHEME,
      network: X402_NETWORK,
      fundsEscrow: false,
      error: error instanceof Error ? error.message : "The facilitator could not be reached.",
    }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
