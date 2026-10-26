import { getAppChain, OFFICIAL_LINKS } from "@/lib/chain/config";
import { loadAgreement, x402Client } from "@/lib/x402/load-agreement";
import { paymentCalls } from "@/lib/x402/payment";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ escrowId: string }> }) {
  const { escrowId } = await context.params;
  const loaded = await loadAgreement(escrowId);
  if ("error" in loaded) return Response.json({ error: loaded.error }, { status: loaded.status });

  const { model, escrow, musd } = loaded;
  const origin = new URL(request.url).origin;
  const checkoutUrl = `${origin}/checkout/${escrowId}`;
  const receipt = {
    product: "RELAY",
    agreementId: model.id.toString(),
    state: model.state,
    amount: model.amount.toString(),
    asset: musd,
    network: `eip155:${getAppChain().id}`,
    escrow,
    seller: model.seller,
    buyer: model.buyer,
    resolver: model.resolver,
    metadataHash: model.metadataHash,
    termsHash: model.termsHash,
    checkoutUrl,
    receiptUrl: `${origin}/receipt/${escrowId}`,
  };

  const block = await x402Client().getBlock();
  const fundingOpen = model.state === "Created" && Number(block.timestamp) <= model.fundingDeadline;
  if (!fundingOpen) {
    return Response.json(receipt, { status: 200, headers: { "cache-control": "no-store" } });
  }

  const calls = paymentCalls(escrow, musd, model.id, model.amount);
  const settleUrl = `${origin}/api/x402/agreements/${escrowId}/settle`;
  const requirements = {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: checkoutUrl,
      description: model.metadata?.title ?? `RELAY agreement ${escrowId}`,
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "relay-escrow",
        network: `eip155:${getAppChain().id}`,
        asset: musd,
        amount: model.amount.toString(),
        payTo: escrow,
        extra: {
          escrow,
          escrowId,
          calls,
          mezo: {
            borrowOrSwap: "https://testnet.mezo.org",
            borrowDocs: OFFICIAL_LINKS.borrow,
          },
          note: "Sign approve, then sign fundEscrow or fundEscrowAsAgent. POST the signed transaction to settle. A direct MUSD transfer is not accepted.",
        },
      },
    ],
    settle: {
      method: "POST",
      url: settleUrl,
      accepts: ["signedTransaction", "txHash"],
    },
    relay: receipt,
  };
  return new Response(JSON.stringify(requirements), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "payment-required": Buffer.from(JSON.stringify(requirements)).toString("base64"),
    },
  });
}
