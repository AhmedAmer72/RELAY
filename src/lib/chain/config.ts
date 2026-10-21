import { getAddress, isAddress, type Address } from "viem";
import { defineChain } from "viem";

/**
 * Defaults were checked on 2026-10-25:
 * - https://mezo.org/docs/developers/getting-started/configure-environment/
 * - https://mezo.org/docs/users/resources/contracts-reference/
 * - eth_chainId, symbol(), name(), and decimals() on the testnet RPC
 *
 * Mainnet is intentionally not selectable. An invalid explicit address does not fall back.
 */
export const VERIFIED_TESTNET = {
  chainId: 31611,
  name: "Mezo Testnet",
  rpcUrl: "https://rpc.test.mezo.org",
  explorerUrl: "https://explorer.test.mezo.org",
  musd: getAddress("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"),
  escrow: getAddress("0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46"),
  deployBlock: 16369215n,
  legacyEscrow: getAddress("0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125"),
  legacyDeployBlock: 16358867n,
  priorEscrows: [
    getAddress("0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125"),
    getAddress("0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087"),
  ],
  musdSymbol: "MUSD",
  musdDecimals: 18,
  nativeSymbol: "BTC",
  nativeDecimals: 18,
} as const;

export const mezoTestnet = defineChain({
  id: VERIFIED_TESTNET.chainId,
  name: VERIFIED_TESTNET.name,
  nativeCurrency: {
    name: "Bitcoin",
    symbol: VERIFIED_TESTNET.nativeSymbol,
    decimals: VERIFIED_TESTNET.nativeDecimals,
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MEZO_TESTNET_RPC_URL || VERIFIED_TESTNET.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Mezo Explorer",
      url: (process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || VERIFIED_TESTNET.explorerUrl).replace(/\/$/, ""),
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
  testnet: true,
});

export const localChain = defineChain({
  id: 31337,
  name: "Local Hardhat",
  nativeCurrency: { name: "Local gas", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545"] },
  },
  testnet: true,
});

export type ChainEnv = "testnet" | "local";

export function getChainEnv(): ChainEnv {
  return process.env.NEXT_PUBLIC_CHAIN_ENV === "local" ? "local" : "testnet";
}

export function getAppChain() {
  return getChainEnv() === "local" ? localChain : mezoTestnet;
}

export function getRpcUrl() {
  return getAppChain().rpcUrls.default.http[0];
}

type AddressRead = { address?: Address; error?: string };

function readAddress(raw: string | undefined, fallback?: Address, label = "address"): AddressRead {
  if (raw === undefined || raw.trim() === "") {
    return fallback ? { address: fallback } : {};
  }
  if (!isAddress(raw)) {
    return { error: `The configured ${label} is not a valid address.` };
  }
  return { address: getAddress(raw) };
}

export function getMusdConfig(): AddressRead {
  if (getChainEnv() === "local") {
    return readAddress(process.env.NEXT_PUBLIC_LOCAL_MUSD_ADDRESS, undefined, "local MUSD address");
  }
  return readAddress(process.env.NEXT_PUBLIC_MUSD_TESTNET_ADDRESS, VERIFIED_TESTNET.musd, "MUSD address");
}

export function getEscrowConfig(): AddressRead {
  if (getChainEnv() === "local") {
    return readAddress(process.env.NEXT_PUBLIC_LOCAL_ESCROW_ADDRESS, undefined, "local escrow address");
  }
  return readAddress(process.env.NEXT_PUBLIC_ESCROW_TESTNET_ADDRESS, VERIFIED_TESTNET.escrow, "escrow address");
}

export function getLegacyEscrowConfig(): AddressRead {
  if (getChainEnv() === "local") return {};
  return readAddress(process.env.NEXT_PUBLIC_ESCROW_LEGACY_ADDRESS, VERIFIED_TESTNET.legacyEscrow, "legacy escrow address");
}

export function escrowPath(kind: "checkout" | "escrows" | "receipt", id: bigint | string, contractAddress?: Address) {
  const path = `/${kind}/${id.toString()}`;
  const primary = getEscrowConfig().address;
  if (!contractAddress || !primary || contractAddress.toLowerCase() === primary.toLowerCase()) return path;
  return `${path}?escrow=${contractAddress}`;
}

export function getEscrowAddresses(): Address[] {
  const addresses = [getEscrowConfig().address, getLegacyEscrowConfig().address];
  if (getChainEnv() === "testnet") addresses.push(...VERIFIED_TESTNET.priorEscrows);
  const present = addresses.filter((item): item is Address => Boolean(item));
  return [...new Map(present.map((item) => [item.toLowerCase(), item])).values()];
}

export function getDeployBlock(): bigint | undefined {
  const raw = process.env.NEXT_PUBLIC_ESCROW_DEPLOY_BLOCK;
  const configured = raw && /^\d+$/.test(raw) ? BigInt(raw) : undefined;
  if (getChainEnv() !== "testnet") return configured;
  const earliest = VERIFIED_TESTNET.legacyDeployBlock;
  if (configured === undefined || earliest < configured) return earliest;
  return configured;
}

type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function injectedProvider(): InjectedProvider | undefined {
  if (typeof window === "undefined") return undefined;
  const ethereum = (window as Window & { ethereum?: InjectedProvider }).ethereum;
  return ethereum?.request ? ethereum : undefined;
}

export async function addAppChain() {
  const ethereum = injectedProvider();
  if (!ethereum) throw new Error("No injected wallet was found. Install a wallet that supports custom networks, then refresh.");
  const chain = getAppChain();
  await ethereum.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: `0x${chain.id.toString(16)}`,
      chainName: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: [...chain.rpcUrls.default.http],
      blockExplorerUrls: chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : [],
    }],
  });
  await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chain.id.toString(16)}` }] });
}

export function explorerBase(): string | undefined {
  if (getChainEnv() !== "testnet") return undefined;
  const base = mezoTestnet.blockExplorers?.default.url;
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function explorerTxUrl(hash?: string) {
  const base = explorerBase();
  if (!base || !hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return undefined;
  return `${base}/tx/${hash}`;
}

export function explorerAddressUrl(address?: string) {
  const base = explorerBase();
  if (!base || !address || !isAddress(address)) return undefined;
  return `${base}/address/${getAddress(address)}`;
}

export const OFFICIAL_LINKS = {
  docs: "https://mezo.org/docs/developers/",
  network: "https://mezo.org/docs/developers/getting-started/configure-environment/",
  contracts: "https://mezo.org/docs/users/resources/contracts-reference/",
  faucet: "https://faucet.test.mezo.org/",
  borrow: "https://mezo.org/feature/borrow",
  musdQuickstart: "https://mezo.org/docs/developers/getting-started/musd-payments-x402/x402-quickstart/",
  explorer: "https://explorer.test.mezo.org/",
} as const;
