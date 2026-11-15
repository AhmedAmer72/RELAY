import fs from "fs";
import path from "path";

export type StoredEvent = {
  id: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: number;
  name: string;
  contractAddress: string;
  escrowId?: string;
  args: Record<string, string | boolean>;
};

export type StoredWebhook = {
  id: string;
  url: string;
  secret: string;
  owner: string;
  party?: string;
  createdAt: string;
  lastError?: string;
  attempts: number;
};

export type StoredTemplate = {
  id: string;
  seller: string;
  json: string;
  createdAt: string;
};

export type ScanStatus = {
  status: "idle" | "indexing" | "caughtUp" | "error";
  from?: string;
  to?: string;
  latest?: string;
  error?: string;
};

export type RelayDb = {
  cursor?: string;
  events: StoredEvent[];
  webhooks: StoredWebhook[];
  templates: StoredTemplate[];
  parties: Record<string, { seller: string; buyer: string }>;
  scan: ScanStatus;
};

const EMPTY: RelayDb = { events: [], webhooks: [], templates: [], parties: {}, scan: { status: "idle" } };

export function dataDir() {
  return process.env.RELAY_DATA_DIR || path.join(process.cwd(), "data");
}

function dbPath() {
  return path.join(dataDir(), "relay-index.json");
}

let chain: Promise<unknown> = Promise.resolve();

export function withLock<T>(work: () => Promise<T> | T) {
  const run = chain.then(work, work);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

export function readDb(): RelayDb {
  try {
    const parsed = JSON.parse(fs.readFileSync(dbPath(), "utf8")) as Partial<RelayDb>;
    return {
      cursor: parsed.cursor,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      webhooks: Array.isArray(parsed.webhooks) ? parsed.webhooks : [],
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      parties: parsed.parties ?? {},
      scan: parsed.scan ?? { status: "idle" },
    };
  } catch {
    return { ...EMPTY, events: [], webhooks: [], templates: [], parties: {}, scan: { status: "idle" } };
  }
}

export function writeDb(db: RelayDb) {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = dbPath();
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(db));
  fs.renameSync(temporary, target);
}

export function evidencePath(cid: string) {
  return path.join(dataDir(), "evidence", cid);
}
