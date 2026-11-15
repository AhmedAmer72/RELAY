import { createHmac, randomBytes } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { getAddress, verifyMessage } from "viem";
import { readDb, withLock, writeDb, type RelayDb, type StoredEvent, type StoredWebhook } from "@/lib/store/db";

function privateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.includes("127.0.0.1")) return true;
  const parts = normalized.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return normalized.includes(":");
  const [first, second] = parts;
  return first === 10 || first === 127 || first === 0
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127);
}

export async function assertPublicHttps(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Webhook URLs must use https.");
  if (url.username || url.password) throw new Error("Webhook URLs cannot include credentials.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new Error("That host is not allowed.");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((item) => item.address);
  if (addresses.length === 0 || addresses.some(privateAddress)) throw new Error("That host is not allowed.");
  return raw.trim();
}

export function webhookMessage(url: string) {
  return `RELAY webhook\n${url}`;
}

export function alertMessage(url: string) {
  return `RELAY alert\n${url}`;
}

export function envWebhooks(): StoredWebhook[] {
  const raw = process.env.RELAY_WEBHOOKS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { url?: string; secret?: string }[];
    return parsed.flatMap((item, index) => {
      if (!item.url || !item.secret) return [];
      return [{ id: `env-${index}`, url: item.url, secret: item.secret, owner: "env", createdAt: "", attempts: 0 }];
    });
  } catch {
    return [];
  }
}

export async function registerWebhook(input: { url: string; owner: string; signature: `0x${string}` }) {
  const url = await assertPublicHttps(input.url);
  const owner = getAddress(input.owner);
  const valid = await verifyMessage({ address: owner, message: webhookMessage(url), signature: input.signature });
  if (!valid) throw new Error("The webhook registration signature does not match this wallet.");
  const secret = randomBytes(32).toString("hex");
  const record: StoredWebhook = { id: randomBytes(8).toString("hex"), url, secret, owner, createdAt: new Date().toISOString(), attempts: 0 };
  await withLock(() => {
    const db = readDb();
    db.webhooks = [record, ...db.webhooks.filter((item) => item.url !== url || item.owner !== owner)].slice(0, 50);
    writeDb(db);
  });
  return { id: record.id, secret };
}

export async function registerAlert(input: { url: string; owner: string; signature: `0x${string}` }) {
  const url = await assertPublicHttps(input.url);
  const owner = getAddress(input.owner);
  const valid = await verifyMessage({ address: owner, message: alertMessage(url), signature: input.signature });
  if (!valid) throw new Error("The alert signature does not match this wallet.");
  const secret = randomBytes(32).toString("hex");
  const record: StoredWebhook = { id: randomBytes(8).toString("hex"), url, secret, owner, party: owner, createdAt: new Date().toISOString(), attempts: 0 };
  await withLock(() => {
    const db = readDb();
    db.webhooks = [record, ...db.webhooks.filter((item) => item.url !== url || item.party !== owner)].slice(0, 50);
    writeDb(db);
  });
  return { id: record.id, secret };
}

function signature(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverEvents(events: StoredEvent[], db: RelayDb) {
  if (events.length === 0) return;
  const hooks = [...db.webhooks, ...envWebhooks()];
  for (const event of events) {
    const body = JSON.stringify({
      name: event.name,
      escrowId: event.escrowId ?? null,
      contract: event.contractAddress,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
    });
    for (const hook of hooks) {
      if (hook.party) {
        const party = db.parties[`${event.contractAddress.toLowerCase()}:${event.escrowId ?? ""}`];
        const watch = hook.party.toLowerCase();
        if (!party || (party.seller.toLowerCase() !== watch && party.buyer.toLowerCase() !== watch)) continue;
      }
      let lastError: string | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(hook.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-relay-signature": signature(hook.secret, body),
            },
            body,
            signal: AbortSignal.timeout(5_000),
          });
          if (!response.ok) throw new Error(`Webhook responded ${response.status}.`);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : "The webhook request failed.";
        }
      }
      const stored = db.webhooks.find((item) => item.id === hook.id);
      if (stored) {
        stored.lastError = lastError;
        stored.attempts = lastError ? 3 : 0;
      }
    }
  }
}
