import { scanOnce } from "@/lib/index/scan";

function authorized(request: Request) {
  const token = process.env.RELAY_INDEXER_TOKEN || process.env.CRON_SECRET;
  if (!token) return false;
  const header = request.headers.get("x-relay-indexer-token");
  const bearer = request.headers.get("authorization");
  return header === token || bearer === `Bearer ${token}`;
}

async function tick(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "The indexer tick is not authorized." }, { status: process.env.RELAY_INDEXER_TOKEN || process.env.CRON_SECRET ? 401 : 503 });
  }
  const scan = await scanOnce();
  return Response.json(scan);
}

export const GET = tick;
export const POST = tick;
