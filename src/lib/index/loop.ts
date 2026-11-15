import { scanOnce } from "@/lib/index/scan";

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

export function startIndexer() {
  if (timer || process.env.RELAY_INDEXER === "off") return;
  const tick = () => {
    if (running) return;
    running = true;
    void scanOnce().catch(() => undefined).finally(() => {
      running = false;
    });
  };
  tick();
  timer = setInterval(tick, 20_000);
}
