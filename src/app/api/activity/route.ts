import { activityView, scanOnce } from "@/lib/index/scan";
import { VERIFIED_TESTNET } from "@/lib/chain/config";

let lastRetry = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("retry") === "1" && Date.now() - lastRetry > 10_000) {
    lastRetry = Date.now();
    await scanOnce();
  }
  const escrowId = url.searchParams.get("escrowId") ?? undefined;
  const name = url.searchParams.get("name") ?? undefined;
  let view = activityView(escrowId, name);
  if (view.scan.status === "idle") {
    await scanOnce();
    view = activityView(escrowId, name);
  }
  return Response.json({
    items: view.items,
    caughtUp: view.scan.status === "caughtUp",
    indexing: view.scan.status === "indexing" || view.scan.status === "idle",
    error: view.scan.status === "error" ? view.scan.error ?? "The activity scan failed." : undefined,
    from: view.scan.from ?? VERIFIED_TESTNET.legacyDeployBlock.toString(),
    to: view.scan.to,
    latest: view.scan.latest,
  });
}
