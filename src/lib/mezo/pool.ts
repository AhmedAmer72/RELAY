import { getAddress, type Address } from "viem";
import { VERIFIED_TESTNET } from "@/lib/chain/config";
import { formatMusd } from "@/lib/escrow/format";
import { MEZO_TESTNET_SYSTEM } from "@/lib/mezo/system";

export const SWAP_SLIPPAGE_BPS = 50n;
export const SWAP_DEADLINE_SECONDS = 20n * 60n;
export const VOLATILE_FEE_BPS = 30n;

export type PoolRoute = {
  from: Address;
  to: Address;
  stable: false;
  factory: Address;
};

export function btcToMusdRoute(): PoolRoute {
  return {
    from: MEZO_TESTNET_SYSTEM.btcToken,
    to: VERIFIED_TESTNET.musd,
    stable: false,
    factory: MEZO_TESTNET_SYSTEM.basicFactory,
  };
}

export function poolMatchesMusdBtc(token0?: Address, token1?: Address) {
  if (!token0 || !token1) return false;
  const tokens = [getAddress(token0), getAddress(token1)];
  return tokens.includes(VERIFIED_TESTNET.musd) && tokens.includes(MEZO_TESTNET_SYSTEM.btcToken);
}

export function suggestBtcIn(shortfall: bigint, reserveMusd: bigint, reserveBtc: bigint, feeBps = VOLATILE_FEE_BPS) {
  if (shortfall <= 0n || reserveMusd <= shortfall || reserveBtc <= 0n || feeBps >= 10_000n) return undefined;
  const withFee = 10_000n - feeBps;
  const numerator = reserveBtc * shortfall * 10_000n;
  const denominator = (reserveMusd - shortfall) * withFee;
  return numerator / denominator + 1n;
}

export function swapResultNote(before: bigint, after: bigint) {
  return `The swap receipt succeeded. Funding was not sent. MUSD balance was ${formatMusd(before)} and is now ${formatMusd(after)}.`;
}

export function minimumOut(quoted: bigint, slippageBps = SWAP_SLIPPAGE_BPS) {
  if (quoted <= 0n || slippageBps < 0n || slippageBps >= 10_000n) return undefined;
  const kept = quoted - (quoted * slippageBps) / 10_000n;
  if (kept < 1n) return undefined;
  return kept;
}
