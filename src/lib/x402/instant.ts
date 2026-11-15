import { getAddress, isAddress, type Address } from "viem";
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type FacilitatorClient,
  type HTTPAdapter,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { VERIFIED_TESTNET } from "@/lib/chain/config";

export const X402_NETWORK = "eip155:31611";
export const X402_SCHEME = "exact";
export const X402_FACILITATOR = "https://facilitator.vativ.io";
export const X402_PRICE = "$0.001";
export const INSTANT_PATH = "/api/x402/instant";

export function payToProblem(payTo: string | undefined, escrow = VERIFIED_TESTNET.escrow) {
  if (!payTo || !isAddress(payTo)) {
    return "X402_PAY_TO is not configured. This route pays a merchant with the official exact scheme and does not fund RelayEscrow.";
  }
  if (getAddress(payTo) === getAddress(escrow)) {
    return "X402_PAY_TO is the escrow contract. An official x402 transfer does not fund an agreement.";
  }
  return undefined;
}

class NextPaymentAdapter implements HTTPAdapter {
  constructor(private request: Request) {}

  getHeader(name: string) {
    return this.request.headers.get(name) ?? undefined;
  }

  getMethod() {
    return this.request.method;
  }

  getPath() {
    return new URL(this.request.url).pathname;
  }

  getUrl() {
    return this.request.url;
  }

  getAcceptHeader() {
    return this.request.headers.get("accept") ?? "";
  }

  getUserAgent() {
    return this.request.headers.get("user-agent") ?? "";
  }

  getQueryParams() {
    const params: Record<string, string> = {};
    new URL(this.request.url).searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  getQueryParam(name: string) {
    return new URL(this.request.url).searchParams.get(name) ?? undefined;
  }

  getBody() {
    return undefined;
  }
}

export async function instantPaymentResult(request: Request, payTo: Address, facilitator?: FacilitatorClient) {
  const client = facilitator ?? new HTTPFacilitatorClient({ url: X402_FACILITATOR });
  const resource = new x402ResourceServer(client).register(X402_NETWORK, new ExactEvmScheme());
  const httpServer = new x402HTTPResourceServer(resource, {
    [`GET ${INSTANT_PATH}`]: {
      accepts: {
        scheme: X402_SCHEME,
        price: X402_PRICE,
        network: X402_NETWORK,
        payTo,
      },
      description: "RELAY instant MUSD payment. This does not fund an escrow.",
    },
  });
  await httpServer.initialize();
  const adapter = new NextPaymentAdapter(request);
  const context = {
    adapter,
    path: adapter.getPath(),
    method: adapter.getMethod(),
    paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment"),
  };
  const result = await httpServer.processHTTPRequest(context, { appName: "RELAY", testnet: true });
  if (result.type !== "payment-verified") return result;
  const settled = await httpServer.processSettlement(result.paymentPayload, result.paymentRequirements);
  if (!settled.success) {
    return { type: "payment-error" as const, response: { status: 402, headers: settled.headers, body: { error: settled.errorReason, fundsEscrow: false } } };
  }
  return {
    type: "paid" as const,
    headers: settled.headers,
    body: {
      ok: true,
      product: "RELAY",
      scheme: X402_SCHEME,
      network: X402_NETWORK,
      fundsEscrow: false,
      message: "Paid. This was an instant MUSD transfer to the merchant, not an escrow deposit.",
      transaction: settled.transaction,
    },
  };
}

export function instantHttpResponse(result: Awaited<ReturnType<typeof instantPaymentResult>>) {
  if (result.type === "paid") {
    return Response.json(result.body, { status: 200, headers: result.headers });
  }
  if (result.type === "payment-error") {
    const headers = new Headers(result.response.headers);
    if (result.response.isHtml) {
      headers.set("content-type", "text/html; charset=utf-8");
      return new Response(typeof result.response.body === "string" ? result.response.body : "", { status: result.response.status, headers });
    }
    return Response.json(result.response.body ?? { fundsEscrow: false }, { status: result.response.status, headers });
  }
  return Response.json({ error: "The instant payment route was not protected.", fundsEscrow: false }, { status: 500 });
}
