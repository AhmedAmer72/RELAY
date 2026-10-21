"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useBlock, useBytecode, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { getAppChain, getDeployBlock, getEscrowAddresses, getEscrowConfig, getMusdConfig } from "@/lib/chain/config";
import type { Address } from "viem";
import { loadEscrowEvents } from "@/lib/chain/logs";
import { erc20Abi } from "@/lib/contracts/erc20";
import { relayEscrowAbi } from "@/lib/contracts/relayEscrowAbi";
import { coerceRawEscrow, parseEscrow } from "@/lib/escrow/parse";
import { evaluateEscrow } from "@/lib/escrow/policy";
import type { EscrowModel } from "@/lib/escrow/types";

export function useProtocol() {
  const chain = getAppChain();
  const musd = getMusdConfig();
  const escrow = getEscrowConfig();
  const account = useAccount();
  const block = useBlock({ chainId: chain.id, query: { refetchInterval: 12_000 } });
  const code = useBytecode({
    address: escrow.address,
    chainId: chain.id,
    query: { enabled: Boolean(escrow.address) },
  });
  const token = useReadContracts({
    allowFailure: true,
    contracts: musd.address
      ? [
          { address: musd.address, abi: erc20Abi, functionName: "symbol", chainId: chain.id },
          { address: musd.address, abi: erc20Abi, functionName: "decimals", chainId: chain.id },
          { address: musd.address, abi: erc20Abi, functionName: "name", chainId: chain.id },
        ]
      : [],
    query: { enabled: Boolean(musd.address) },
  });
  const balance = useReadContract({
    address: musd.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account.address ? [account.address] : undefined,
    chainId: chain.id,
    query: { enabled: Boolean(musd.address && account.address), refetchInterval: 15_000 },
  });
  const allowance = useReadContract({
    address: musd.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: account.address && escrow.address ? [account.address, escrow.address] : undefined,
    chainId: chain.id,
    query: { enabled: Boolean(musd.address && escrow.address && account.address), refetchInterval: 15_000 },
  });
  const native = useBalance({ address: account.address, chainId: chain.id, query: { enabled: Boolean(account.address) } });
  const symbol = token.data?.[0]?.status === "success" ? token.data[0].result : undefined;
  const decimals = token.data?.[1]?.status === "success" ? token.data[1].result : undefined;
  const tokenName = token.data?.[2]?.status === "success" ? token.data[2].result : undefined;

  return {
    chain,
    musd,
    escrow,
    account,
    chainMatches: !account.isConnected || account.chainId === chain.id,
    now: block.data ? Number(block.data.timestamp) : undefined,
    blockUpdatedAt: block.dataUpdatedAt,
    refetchBlock: () => block.refetch(),
    hasContractCode: code.data === undefined ? undefined : code.data !== "0x",
    symbol: typeof symbol === "string" ? symbol : undefined,
    decimals: typeof decimals === "number" ? decimals : undefined,
    tokenName: typeof tokenName === "string" ? tokenName : undefined,
    balance: typeof balance.data === "bigint" ? balance.data : undefined,
    allowance: typeof allowance.data === "bigint" ? allowance.data : undefined,
    nativeBalance: native.data?.value,
    refetchBalances: async () => {
      await Promise.all([balance.refetch(), allowance.refetch(), native.refetch(), token.refetch()]);
    },
  };
}

function notFound(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return text.includes("EscrowNotFound");
}

async function readEscrowAt(client: NonNullable<ReturnType<typeof usePublicClient>>, address: Address, id: bigint) {
  const raw = await client.readContract({
    address,
    abi: relayEscrowAbi,
    functionName: "getEscrow",
    args: [id],
  });
  let partialSettlement = false;
  try {
    partialSettlement = await client.readContract({
      address,
      abi: relayEscrowAbi,
      functionName: "partialSettlementSupported",
    });
  } catch {
    partialSettlement = false;
  }
  return { raw, model: parseEscrow(id, coerceRawEscrow(raw)), contractAddress: address, partialSettlement };
}

export function useEscrow(id?: bigint, preferred?: Address) {
  const client = usePublicClient({ chainId: getAppChain().id });
  const addresses = preferred ? [preferred] : getEscrowAddresses();
  const query = useQuery({
    queryKey: ["escrow", id?.toString(), addresses.join(",")],
    enabled: Boolean(client && id && id > 0n && addresses.length > 0),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!client || !id) throw new Error("The network client is unavailable.");
      let lastError: unknown;
      for (const address of addresses) {
        try {
          return await readEscrowAt(client, address, id);
        } catch (error) {
          lastError = error;
          if (notFound(error)) continue;
          throw error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("EscrowNotFound");
    },
  });
  return {
    ...query,
    data: query.data?.raw,
    model: query.data?.model,
    contractAddress: query.data?.contractAddress,
    partialSettlement: query.data?.partialSettlement ?? false,
  };
}

export type IndexedEscrow = EscrowModel & { contractAddress: Address };

async function readEscrowIndex(client: NonNullable<ReturnType<typeof usePublicClient>>, address: Address, limit: number) {
  const nextId = await client.readContract({
    address,
    abi: relayEscrowAbi,
    functionName: "nextEscrowId",
  });
  const total = nextId > 1n ? nextId - 1n : 0n;
  const capped = total > BigInt(limit) ? BigInt(limit) : total;
  const ids: bigint[] = [];
  for (let offset = 0n; offset < capped; offset += 1n) ids.push(nextId - 1n - offset);
  const models: IndexedEscrow[] = [];
  for (let index = 0; index < ids.length; index += 25) {
    const slice = ids.slice(index, index + 25);
    const rows = await client.multicall({
      allowFailure: true,
      contracts: slice.map((id) => ({
        address,
        abi: relayEscrowAbi,
        functionName: "getEscrow" as const,
        args: [id] as const,
      })),
    });
    slice.forEach((id, rowIndex) => {
      const row = rows[rowIndex];
      if (!row || row.status !== "success") return;
      try {
        models.push({ ...parseEscrow(id, coerceRawEscrow(row.result)), contractAddress: address });
      } catch {
        // An unreadable row is skipped. It is not shown as an empty agreement.
      }
    });
  }
  return { nextId, models, truncated: total > BigInt(limit) };
}

export function useRecentEscrows(limit = 1000) {
  const client = usePublicClient({ chainId: getAppChain().id });
  const addresses = getEscrowAddresses();
  const query = useQuery({
    queryKey: ["escrow-index", addresses.join(","), limit],
    enabled: Boolean(client && addresses.length > 0),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!client || addresses.length === 0) throw new Error("The network client is unavailable.");
      const indexes = await Promise.all(addresses.map((address) => readEscrowIndex(client, address, limit)));
      const models = indexes.flatMap((item) => item.models).sort((left, right) => (left.id === right.id ? left.contractAddress.localeCompare(right.contractAddress) : left.id > right.id ? -1 : 1));
      return {
        nextId: indexes[0]?.nextId,
        models,
        truncated: indexes.some((item) => item.truncated),
      };
    },
  });
  return {
    nextId: query.data?.nextId,
    models: query.data?.models ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    truncated: query.data?.truncated ?? false,
    refetch: query.refetch,
    updatedAt: query.dataUpdatedAt,
  };
}

export function useChainEvents(escrowId?: bigint, contractAddress?: Address) {
  const client = usePublicClient({ chainId: getAppChain().id });
  const addresses = contractAddress ? [contractAddress] : getEscrowAddresses();
  return useQuery({
    queryKey: ["relay-events", addresses.join(","), escrowId?.toString() ?? "all", getDeployBlock()?.toString() ?? "lookback"],
    enabled: Boolean(client && addresses.length > 0),
    queryFn: async () => {
      if (!client || addresses.length === 0) throw new Error("The network client is unavailable.");
      const latest = await client.getBlockNumber();
      const deploy = getDeployBlock();
      let from = deploy ?? (latest > 50_000n ? latest - 50_000n : 0n);
      let partial = deploy === undefined;
      if (latest > from && latest - from > 200_000n) {
        from = latest - 200_000n;
        partial = true;
      }
      const batches = await Promise.all(addresses.map((address) => loadEscrowEvents(client, address, from, latest, escrowId)));
      const items = batches.flat().sort((left, right) => (left.blockNumber === right.blockNumber ? 0 : left.blockNumber > right.blockNumber ? -1 : 1));
      return { items, from, latest, partial };
    },
  });
}

export function panelFor(model: EscrowModel, protocol: ReturnType<typeof useProtocol>, partialSettlement = false, agentAllowance?: bigint) {
  return evaluateEscrow({
    escrow: model,
    wallet: protocol.account.address,
    now: protocol.now,
    chainMatches: protocol.chainMatches,
    configured: Boolean(protocol.escrow.address) && !protocol.escrow.error,
    networkName: protocol.chain.name,
    hasContractCode: protocol.hasContractCode,
    decimals: protocol.decimals,
    symbol: protocol.symbol,
    balance: protocol.balance,
    allowance: protocol.allowance,
    nativeBalance: protocol.nativeBalance,
    partialSettlement,
    agentAllowance,
  });
}
