import { type Address, type Hex, type PublicClient } from "viem";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";

const EVENT_NAMES = [
  "EscrowCreated",
  "EscrowFunded",
  "DeliverySubmitted",
  "DisputeRaised",
  "EscrowReleased",
  "EscrowRefunded",
  "DisputeResolved",
  "EscrowCancelled",
  "DisputeSplit",
  "AgentFunded",
  "MutualCancelProposed",
  "MutualCancelRevoked",
  "AgentDelivered",
  "ProtocolFeePaid",
  "ResolverAccepted",
  "ResolverFeePaid",
  "ReviewExtensionProposed",
  "ReviewExtensionAccepted",
] as const;

const GLOBAL_EVENTS = ["DeliveryAgentSet"] as const;

export type ChainEvent = {
  name: (typeof EVENT_NAMES)[number] | (typeof GLOBAL_EVENTS)[number];
  contractAddress: Address;
  escrowId?: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
  args: Record<string, unknown>;
  timestamp?: number;
};

export async function loadEscrowEvents(
  client: PublicClient,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
  escrowId?: bigint,
) {
  const events: ChainEvent[] = [];
  const chunk = 2_000n;
  for (let start = fromBlock; start <= toBlock; start += chunk) {
    const end = start + chunk - 1n > toBlock ? toBlock : start + chunk - 1n;
    const names = escrowId === undefined ? [...EVENT_NAMES, ...GLOBAL_EVENTS] : EVENT_NAMES;
    for (const eventName of names) {
      const logs = await readEventRange(client, address, eventName, start, end, escrowId);
      for (const log of logs) {
        const args = (log.args ?? {}) as Record<string, unknown>;
        events.push({
          name: eventName,
          contractAddress: address,
          escrowId: typeof args.escrowId === "bigint" ? args.escrowId : escrowId,
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "0x",
          args,
        });
      }
    }
  }
  events.sort((left, right) => (left.blockNumber === right.blockNumber ? 0 : left.blockNumber > right.blockNumber ? -1 : 1));
  const limited = events.slice(0, 200);
  const uniqueBlocks = [...new Set(limited.map((event) => event.blockNumber))].slice(0, 40);
  const timestamps = new Map<bigint, number>();
  await Promise.all(uniqueBlocks.map(async (blockNumber) => {
    const block = await client.getBlock({ blockNumber });
    timestamps.set(blockNumber, Number(block.timestamp));
  }));
  return limited.map((event) => ({ ...event, timestamp: timestamps.get(event.blockNumber) }));
}

type EscrowLog = {
  args?: Record<string, unknown>;
  blockNumber: bigint | null;
  transactionHash: Hex | null;
};

async function readEventRange(
  client: PublicClient,
  address: Address,
  eventName: ChainEvent["name"],
  fromBlock: bigint,
  toBlock: bigint,
  escrowId?: bigint,
): Promise<EscrowLog[]> {
  try {
    return await client.getContractEvents({
      address,
      abi: relayEscrowAbi,
      eventName,
      fromBlock,
      toBlock,
      args: escrowId === undefined ? undefined : { escrowId },
    }) as EscrowLog[];
  } catch (error) {
    if (toBlock <= fromBlock || toBlock - fromBlock <= 100n) throw error;
    const mid = fromBlock + (toBlock - fromBlock) / 2n;
    const left = await readEventRange(client, address, eventName, fromBlock, mid, escrowId);
    const right = await readEventRange(client, address, eventName, mid + 1n, toBlock, escrowId);
    return [...left, ...right];
  }
}

export function describeEvent(event: ChainEvent) {
  const rawReason = event.args.reason;
  const reason = typeof rawReason === "number" || typeof rawReason === "bigint"
    ? Number(rawReason)
    : typeof rawReason === "string" && /^\d+$/.test(rawReason) ? Number(rawReason) : undefined;
  switch (event.name) {
    case "EscrowCreated":
      return "Agreement created";
    case "EscrowFunded":
      return "Buyer funded the escrow";
    case "DeliverySubmitted":
      return "Seller submitted delivery evidence";
    case "DisputeRaised":
      return "A dispute was raised";
    case "EscrowReleased":
      if (reason === 2) return "Payment finalized to the seller after the review window";
      if (reason === 3) return "Resolver released the full amount to the seller";
      return "Buyer released the funds to the seller";
    case "EscrowRefunded":
      if (reason === 2) return "Resolver refunded the full amount to the buyer";
      if (reason === 3) return "Both parties agreed to a full refund";
      return "Buyer claimed a refund after the missed delivery deadline";
    case "DisputeResolved":
      return event.args.paySeller ? "Resolver chose payment to the seller" : "Resolver chose a refund to the buyer";
    case "EscrowCancelled":
      return "Unfunded agreement cancelled";
    case "DisputeSplit":
      return "Resolver split the escrowed amount between the seller and the buyer";
    case "AgentFunded":
      return "An authorized agent funded the escrow for the buyer";
    case "MutualCancelProposed":
      return "A party proposed a full refund";
    case "MutualCancelRevoked":
      return "The refund request was withdrawn";
    case "AgentDelivered":
      return "A delivery agent submitted the seller's evidence";
    case "ProtocolFeePaid":
      return "Seller fee paid";
    case "ResolverAccepted":
      return "Buyer accepted the resolver";
    case "ResolverFeePaid":
      return "Resolver fee paid from a dispute";
    case "ReviewExtensionProposed":
      return "A later review deadline was proposed";
    case "ReviewExtensionAccepted":
      return "The review deadline was extended";
    case "DeliveryAgentSet":
      return event.args.allowed ? "Seller allowed a delivery agent" : "Seller removed a delivery agent";
    default:
      return "Contract event";
  }
}
