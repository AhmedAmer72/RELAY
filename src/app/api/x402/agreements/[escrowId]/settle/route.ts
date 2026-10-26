import { isHex, parseTransaction, type Hex } from "viem";
import { getAppChain } from "@/lib/chain/config";
import { loadAgreement, x402Client } from "@/lib/x402/load-agreement";
import { classifySettlement } from "@/lib/x402/payment";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ escrowId: string }> }) {
  const { escrowId } = await context.params;
  const loaded = await loadAgreement(escrowId);
  if ("error" in loaded) return Response.json({ error: loaded.error }, { status: loaded.status });

  let body: { signedTransaction?: string; txHash?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a signedTransaction or a txHash." }, { status: 400 });
  }

  const client = x402Client();
  const { model, escrow, musd } = loaded;
  let hash: Hex;
  if (body.signedTransaction && isHex(body.signedTransaction)) {
    let parsed;
    try {
      parsed = parseTransaction(body.signedTransaction);
    } catch {
      return Response.json({ error: "The signed transaction could not be read." }, { status: 400 });
    }
    if (!parsed.to) return Response.json({ error: "The transaction has no destination." }, { status: 400 });
    const kind = classifySettlement(parsed.to, parsed.data ?? "0x", escrow, musd, model.id, model.amount);
    if (!kind) {
      return Response.json({ error: "Only an MUSD approval for this escrow, or fundEscrow for this agreement, can be submitted." }, { status: 400 });
    }
    try {
      hash = await client.sendRawTransaction({ serializedTransaction: body.signedTransaction });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The network rejected the signed transaction.";
      return Response.json({ error: message }, { status: 400 });
    }
  } else if (body.txHash && isHex(body.txHash)) {
    hash = body.txHash;
    const tx = await client.getTransaction({ hash });
    if (!tx.to) return Response.json({ error: "The transaction has no destination." }, { status: 400 });
    const kind = classifySettlement(tx.to, tx.input, escrow, musd, model.id, model.amount);
    if (!kind) {
      return Response.json({ error: "That transaction is not an approval or fund call for this agreement." }, { status: 400 });
    }
  } else {
    return Response.json({ error: "Send a signedTransaction or a txHash." }, { status: 400 });
  }

  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== "success") {
    return Response.json({ error: "The transaction failed on-chain.", hash }, { status: 400 });
  }
  const fresh = await loadAgreement(escrowId);
  if ("error" in fresh) return Response.json({ error: fresh.error, hash }, { status: fresh.status });
  return Response.json({
    product: "RELAY",
    agreementId: escrowId,
    state: fresh.model.state,
    hash,
    network: `eip155:${getAppChain().id}`,
    escrow,
    funded: fresh.model.state !== "Created",
  }, { status: 200, headers: { "cache-control": "no-store" } });
}
