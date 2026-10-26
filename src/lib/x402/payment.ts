import { decodeFunctionData, encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { erc20Abi } from "@/lib/contracts/erc20";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";

export type SettlementKind = "approve" | "fund" | "agent";

export function paymentCalls(escrow: Address, musd: Address, escrowId: bigint, amount: bigint) {
  return {
    approve: {
      to: musd,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [escrow, amount] }),
    },
    fund: {
      to: escrow,
      data: encodeFunctionData({ abi: relayEscrowAbi, functionName: "fundEscrow", args: [escrowId] }),
    },
    fundAsAgent: {
      to: escrow,
      data: encodeFunctionData({ abi: relayEscrowAbi, functionName: "fundEscrowAsAgent", args: [escrowId] }),
    },
  };
}

export function classifySettlement(to: Address, data: Hex, escrow: Address, musd: Address, escrowId: bigint, amount: bigint): SettlementKind | null {
  const target = getAddress(to);
  if (target === getAddress(musd)) {
    try {
      const decoded = decodeFunctionData({ abi: erc20Abi, data });
      if (decoded.functionName !== "approve") return null;
      const [spender, value] = decoded.args;
      if (getAddress(spender) !== getAddress(escrow) || value < amount) return null;
      return "approve";
    } catch {
      return null;
    }
  }
  if (target !== getAddress(escrow)) return null;
  try {
    const decoded = decodeFunctionData({ abi: relayEscrowAbi, data });
    if (decoded.args[0] !== escrowId) return null;
    if (decoded.functionName === "fundEscrow") return "fund";
    if (decoded.functionName === "fundEscrowAsAgent") return "agent";
    return null;
  } catch {
    return null;
  }
}
