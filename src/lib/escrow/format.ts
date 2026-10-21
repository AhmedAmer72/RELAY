import { formatUnits, isAddress } from "viem";

const AMOUNT_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export function parseMusdInput(value: string, decimals = 18): { ok: true; amount: bigint } | { ok: false; error: string } {
  const trimmed = value.trim();
  const match = AMOUNT_PATTERN.exec(trimmed);
  if (!match) return { ok: false, error: "Enter a positive MUSD amount using digits only." };
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return { ok: false, error: `Use at most ${decimals} decimal places.` };
  if (match[1].length > 18) return { ok: false, error: "That amount is too large." };
  try {
    const amount = parseUnitsExact(trimmed, decimals);
    if (amount <= 0n) return { ok: false, error: "Enter an amount greater than zero." };
    return { ok: true, amount };
  } catch {
    return { ok: false, error: "Enter a valid MUSD amount." };
  }
}

function parseUnitsExact(value: string, decimals: number) {
  const [whole, fraction = ""] = value.split(".");
  const padded = fraction.padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/** Display helper. Trailing zeros are hidden after two decimal places; the value is not rounded. */
export function formatMusd(amount: bigint, decimals = 18) {
  const raw = formatUnits(amount, decimals);
  const [whole, fraction = ""] = raw.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const shown = trimmed.length < 2 ? trimmed.padEnd(2, "0") : trimmed;
  return `${whole}.${shown}`;
}

export function formatBaseUnits(amount: bigint) {
  return amount.toString();
}

export function shortAddress(address?: string) {
  if (!address || !isAddress(address)) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function sameAddress(left?: string, right?: string) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isZeroAddress(address?: string) {
  return !address || address.toLowerCase() === ZERO_ADDRESS;
}
