"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { getChainEnv, getRpcUrl, localChain, mezoTestnet } from "@/lib/chain/config";

const injectedConnector = injected({ shimDisconnect: true });

export const wagmiConfig = getChainEnv() === "local"
  ? createConfig({
      chains: [localChain],
      connectors: [injectedConnector],
      transports: { [localChain.id]: http(localChain.rpcUrls.default.http[0]) },
      ssr: false,
    })
  : createConfig({
      chains: [mezoTestnet],
      connectors: [injectedConnector],
      transports: { [mezoTestnet.id]: http(getRpcUrl()) },
      ssr: false,
    });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
  }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
