import { createPublicClient, decodeEventLog, http, type Hex } from "viem";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { getDeployBlock, getEscrowAddresses, getRpcUrl, VERIFIED_TESTNET } from "@/lib/chain/config";
import { deliverEvents } from "@/lib/index/webhooks";
import { readDb, withLock, writeDb, type StoredEvent } from "@/lib/store/db";

const CHUNK = 2_000n;

function stringify(value: unknown): string | boolean | undefined {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return String(value);
  return undefined;
}

export async function scanOnce() {
  await withLock(async () => {
    const db = readDb();
    const client = createPublicClient({ transport: http(getRpcUrl()) });
    try {
      const latest = await client.getBlockNumber();
      const start = db.cursor ? BigInt(db.cursor) : (getDeployBlock() ?? VERIFIED_TESTNET.legacyDeployBlock);
      if (start > latest) {
        db.scan = { status: "caughtUp", from: start.toString(), to: latest.toString(), latest: latest.toString() };
        writeDb(db);
        return [] as StoredEvent[];
      }
      const end = start + CHUNK - 1n > latest ? latest : start + CHUNK - 1n;
      const known = new Set(db.events.map((event) => event.id));
      const added: StoredEvent[] = [];
      for (const address of getEscrowAddresses()) {
        const logs = await client.getLogs({ address, fromBlock: start, toBlock: end });
        for (const log of logs) {
          if (!log.transactionHash || log.logIndex === null) continue;
          const id = `${log.transactionHash}:${log.logIndex}`;
          if (known.has(id)) continue;
          try {
            const decoded = decodeEventLog({ abi: relayEscrowAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
            const args: Record<string, string | boolean> = {};
            for (const [key, value] of Object.entries(decoded.args ?? {})) {
              const printed = stringify(value);
              if (printed !== undefined && key !== "__length__") args[key] = printed;
            }
            const event: StoredEvent = {
              id,
              blockNumber: (log.blockNumber ?? 0n).toString(),
              transactionHash: log.transactionHash,
              logIndex: log.logIndex,
              name: decoded.eventName,
              contractAddress: address,
              escrowId: typeof args.escrowId === "string" ? args.escrowId : undefined,
              args,
            };
            added.push(event);
            known.add(id);
            if (event.escrowId && (event.name === "EscrowCreated" || event.name === "EscrowFunded")) {
              const key = `${address.toLowerCase()}:${event.escrowId}`;
              const current = db.parties[key] ?? { seller: "", buyer: "" };
              if (typeof args.seller === "string") current.seller = args.seller;
              if (typeof args.buyer === "string") current.buyer = args.buyer;
              db.parties[key] = current;
            }
          } catch {
            // A log from another contract version is skipped. It is not stored as an empty event.
          }
        }
      }
      db.events = [...added, ...db.events].sort((left, right) => (left.blockNumber === right.blockNumber ? right.logIndex - left.logIndex : Number(BigInt(right.blockNumber) - BigInt(left.blockNumber))));
      db.cursor = (end + 1n).toString();
      db.scan = {
        status: end >= latest ? "caughtUp" : "indexing",
        from: start.toString(),
        to: end.toString(),
        latest: latest.toString(),
      };
      await deliverEvents(added, db);
      writeDb(db);
      return added;
    } catch (error) {
      const current = readDb();
      current.scan = {
        ...current.scan,
        status: "error",
        error: error instanceof Error ? error.message : "The activity scan failed.",
      };
      writeDb(current);
      return [] as StoredEvent[];
    }
  });
  return readDb().scan;
}

export function activityView(escrowId?: string, name?: string) {
  const db = readDb();
  const matched = db.events.filter((event) => (escrowId === undefined || event.escrowId === escrowId) && (name === undefined || event.name === name));
  return { items: name ? matched : matched.slice(0, 200), scan: db.scan };
}
