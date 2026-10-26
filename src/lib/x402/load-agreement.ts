import { createPublicClient, http, type Address } from "viem";
import { getAppChain, getEscrowAddresses, getMusdConfig } from "@/lib/chain/config";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { coerceRawEscrow, parseEscrow } from "@/lib/escrow/parse";
import type { EscrowModel } from "@/lib/escrow/types";

export function x402Client() {
  return createPublicClient({
    chain: getAppChain(),
    transport: http(getAppChain().rpcUrls.default.http[0]),
  });
}

export async function loadAgreement(escrowId: string): Promise<{ model: EscrowModel; escrow: Address; musd: Address } | { error: string; status: number }> {
  if (!/^[1-9]\d*$/.test(escrowId)) return { error: "Agreement id is not valid.", status: 400 };
  const contracts = getEscrowAddresses();
  const musd = getMusdConfig();
  if (contracts.length === 0 || !musd.address) return { error: "The escrow contract is not configured.", status: 503 };
  const client = x402Client();
  for (const escrow of contracts) {
    try {
      const raw = await client.readContract({
        address: escrow,
        abi: relayEscrowAbi,
        functionName: "getEscrow",
        args: [BigInt(escrowId)],
      });
      return { model: parseEscrow(BigInt(escrowId), coerceRawEscrow(raw)), escrow, musd: musd.address };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.includes("EscrowNotFound")) continue;
      return { error: "The agreement could not be read from the network.", status: 503 };
    }
  }
  return { error: "That agreement was not found on the escrow contract.", status: 404 };
}
