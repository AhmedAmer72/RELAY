"use client";

import { useRef, useState } from "react";
import type { Hex } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import type { TransactionReceipt } from "viem";
import type { TxPhase } from "@/lib/escrow/types";
import { explainError, isUserRejected } from "@/lib/utils/errors";

export function useTrackedTx() {
  const config = useConfig();
  const [phase, setPhase] = useState<TxPhase>({ phase: "idle" });
  const running = useRef(false);

  async function run(action: string, write: () => Promise<Hex>, after?: (receipt: TransactionReceipt) => Promise<void>) {
    if (running.current) return;
    running.current = true;
    let hash: Hex | undefined;
    try {
      setPhase({ phase: "awaiting_wallet", action });
      hash = await write();
      setPhase({ phase: "submitted", action, hash });
      setPhase({ phase: "confirming", action, hash });
      const receipt = await waitForTransactionReceipt(config, { hash, timeout: 120_000 });
      if (receipt.status !== "success") {
        setPhase({
          phase: "reverted",
          action,
          hash,
          message: "The transaction failed on-chain. No successful state change has been confirmed.",
        });
        return;
      }
      try {
        if (after) await after(receipt);
      } catch {
        // The receipt is already successful. Verification is reported by the caller.
      }
      setPhase({ phase: "confirmed", action, hash });
    } catch (error) {
      const explained = explainError(error);
      const text = `${error instanceof Error ? error.name : ""} ${error instanceof Error ? error.message : ""} ${explained.title}`;
      if (!hash && isUserRejected([text])) {
        setPhase({ phase: "rejected", action, message: "You cancelled the wallet request. No change was confirmed on-chain." });
      } else if (hash && /not confirm the result|timed out|timeout/i.test(text)) {
        setPhase({
          phase: "unknown",
          action,
          hash,
          message: "Your transaction was submitted but has not yet been confirmed. Check its status before trying again.",
        });
      } else {
        setPhase({
          phase: "reverted",
          action,
          hash,
          message: hash ? explained.title : explained.title.startsWith("The transaction failed")
            ? "The transaction was not submitted. Check the network and try again when you are ready."
            : explained.title,
        });
      }
    } finally {
      running.current = false;
    }
  }

  return { phase, run, reset: () => setPhase({ phase: "idle" }), busy: running.current || isBusy(phase) };
}

function isBusy(phase: TxPhase) {
  return phase.phase === "preparing" || phase.phase === "awaiting_wallet" || phase.phase === "submitted" || phase.phase === "confirming";
}
