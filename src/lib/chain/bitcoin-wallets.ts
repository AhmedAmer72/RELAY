import { createConnector, type CreateConnectorFn } from "wagmi";
import { getAddress, numberToHex } from "viem";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type WindowWithWallets = Window & {
  unisat?: { request?: Eip1193["request"] };
  okxwallet?: { request?: Eip1193["request"]; ethereum?: Eip1193 };
  XverseProviders?: { Ethereum?: Eip1193; ethereum?: Eip1193 };
  Xverse?: { ethereum?: Eip1193 };
};

function asProvider(value: unknown): Eip1193 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const request = (value as { request?: unknown }).request;
  return typeof request === "function" ? value as Eip1193 : undefined;
}

export function unisatProvider(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return asProvider((window as WindowWithWallets).unisat);
}

export function okxProvider(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  const wallet = (window as WindowWithWallets).okxwallet;
  return asProvider(wallet?.ethereum) ?? asProvider(wallet);
}

export function xverseProvider(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  const root = window as WindowWithWallets;
  return asProvider(root.XverseProviders?.Ethereum) ?? asProvider(root.XverseProviders?.ethereum) ?? asProvider(root.Xverse?.ethereum);
}

export function bitcoinWalletInstalled(id: "unisat" | "okx" | "xverse") {
  if (typeof window === "undefined") return false;
  const root = window as WindowWithWallets;
  if (id === "unisat") return Boolean(root.unisat);
  if (id === "okx") return Boolean(root.okxwallet);
  return Boolean(root.XverseProviders || root.Xverse);
}

function eip1193Connector(id: string, name: string, readProvider: () => Eip1193 | undefined): CreateConnectorFn {
  return createConnector((config) => ({
    id,
    name,
    type: id,
    async setup() {
      const provider = readProvider();
      if (!provider?.on) return;
      provider.on("accountsChanged", (accounts) => {
        const list = Array.isArray(accounts) ? accounts.filter((item): item is string => typeof item === "string") : [];
        if (list.length === 0) config.emitter.emit("disconnect");
        else config.emitter.emit("change", { accounts: list.map((item) => getAddress(item)) });
      });
      provider.on("chainChanged", (chain) => {
        const value = typeof chain === "string" ? Number.parseInt(chain, 16) : Number(chain);
        if (Number.isInteger(value)) config.emitter.emit("change", { chainId: value });
      });
      provider.on("disconnect", () => config.emitter.emit("disconnect"));
    },
    async connect(parameters?: { chainId?: number }) {
      const provider = readProvider();
      if (!provider) throw new Error(`${name} is installed, but this browser build does not expose an Ethereum provider for Mezo.`);
      const result = await provider.request({ method: "eth_requestAccounts" });
      const accounts = (Array.isArray(result) ? result : []).filter((item): item is string => typeof item === "string").map((item) => getAddress(item));
      if (accounts.length === 0) throw new Error(`${name} did not return an account.`);
      const nextChain = parameters?.chainId ?? config.chains[0]?.id;
      if (nextChain) {
        try {
          await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: numberToHex(nextChain) }] });
        } catch {
          // The header still offers Switch network, which adds Mezo Testnet.
        }
      }
      return {
        accounts,
        chainId: nextChain ?? Number(await provider.request({ method: "eth_chainId" })),
      } as never;
    },
    async disconnect() {},
    async getAccounts() {
      const provider = readProvider();
      if (!provider) return [];
      const result = await provider.request({ method: "eth_accounts" });
      return (Array.isArray(result) ? result : []).filter((item): item is string => typeof item === "string").map((item) => getAddress(item));
    },
    async getChainId() {
      const provider = readProvider();
      if (!provider) throw new Error(`${name} is not available.`);
      return Number(await provider.request({ method: "eth_chainId" }));
    },
    async isAuthorized() {
      const accounts = await this.getAccounts();
      return accounts.length > 0;
    },
    async getProvider() {
      return readProvider();
    },
    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
  }));
}

export const unisatConnector = eip1193Connector("unisat", "Unisat", unisatProvider);
export const xverseConnector = eip1193Connector("xverse", "Xverse", xverseProvider);
export const okxConnector = eip1193Connector("okx", "OKX", okxProvider);
