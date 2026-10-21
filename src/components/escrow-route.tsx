"use client";

import { notFound } from "next/navigation";
import { getAddress, isAddress, type Address } from "viem";
import { EscrowWorkspace } from "@/components/escrow/workspace";

export function EscrowRoute({ id, variant, contract }: { id: string; variant: "checkout" | "manage" | "receipt"; contract?: string }) {
  if (!/^[1-9]\d*$/.test(id)) notFound();
  const preferred = contract && isAddress(contract) ? getAddress(contract) : undefined;
  return <EscrowWorkspace id={BigInt(id)} variant={variant} contract={preferred as Address | undefined} />;
}
