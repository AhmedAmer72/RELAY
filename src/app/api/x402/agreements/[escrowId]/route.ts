import { createPublicClient, http } from "viem";
import { getAppChain, getEscrowAddresses, getMusdConfig } from "@/lib/chain/config";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { coerceRawEscrow, parseEscrow } from "@/lib/escrow/parse";

export const dynamic = "force-dynamic";

const client = createPublicClient({
  chain: getAppChain(),
  transport: http(getAppChain().rpcUrls.default.http[0]),
});

export async function GET(request: Request, context: { params: Promise<{ escrowId: string }> }) {
  const { escrowId } = await context.params;
  if (!/^[1-9]\d*$/.test(escrowId)) {
    return Response.json({ error: "Agreement id is not valid." }, { status: 400 });
  }
  const contracts = getEscrowAddresses();
  const musd = getMusdConfig();
  if (contracts.length === 0 || !musd.address) {
    return Response.json({ error: "The escrow contract is not configured." }, { status: 503 });
  }

  let model;
  let escrowAddress = contracts[0];
  let found = false;
  for (const address of contracts) {
    try {
      const raw = await client.readContract({
        address,
        abi: relayEscrowAbi,
        functionName: "getEscrow",
        args: [BigInt(escrowId)],
      });
      model = parseEscrow(BigInt(escrowId), coerceRawEscrow(raw));
      escrowAddress = address;
      found = true;
      break;
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.includes("EscrowNotFound")) continue;
      return Response.json({ error: "The agreement could not be read from the network." }, { status: 503 });
    }
  }
  if (!found || !model) {
    return Response.json({ error: "That agreement was not found on the escrow contract." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const checkoutUrl = `${origin}/checkout/${escrowId}`;
  const receipt = {
    product: "RELAY",
    agreementId: model.id.toString(),
    state: model.state,
    amount: model.amount.toString(),
    asset: musd.address,
    network: `eip155:${getAppChain().id}`,
    escrow: escrowAddress,
    seller: model.seller,
    buyer: model.buyer,
    resolver: model.resolver,
    metadataHash: model.metadataHash,
    termsHash: model.termsHash,
    checkoutUrl,
    receiptUrl: `${origin}/receipt/${escrowId}`,
  };

  const block = await client.getBlock();
  const fundingOpen = model.state === "Created" && Number(block.timestamp) <= model.fundingDeadline;
  if (!fundingOpen) {
    return Response.json(receipt, { status: 200, headers: { "cache-control": "no-store" } });
  }

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
        asset: musd.address,
        amount: model.amount.toString(),
        extra: {
          escrow: escrowAddress,
          escrowId,
          approve: "erc20.approve",
          settle: "fundEscrow",
          checkoutUrl,
          note: "Do not transfer MUSD directly to the escrow contract. Direct transfers are not credited to an agreement. Approve the exact amount, then call fundEscrow.",
        },
      },
    ],
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
