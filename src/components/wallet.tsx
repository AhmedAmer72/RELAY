"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { bitcoinWalletInstalled } from "@/lib/chain/bitcoin-wallets";
import { addAppChain, getAppChain } from "@/lib/chain/config";
import { shortAddress } from "@/lib/escrow/format";
import { Button } from "@/components/ui";

function cnButton(meadow: boolean) {
  return meadow
    ? `${headerButton} !border-transparent !bg-meadow !text-brand hover:!bg-[#8fdf55]`
    : headerButton;
}

const headerButton = "!h-10 !min-h-10 !px-4 !py-0 hover:!translate-y-0";

export function WalletControls() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string>();
  const [hintOpen, setHintOpen] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const chain = getAppChain();

  useEffect(() => setReady(true), []);

  if (!ready) return <Button variant="secondary" className={headerButton} disabled>Connect wallet</Button>;

  if (!isConnected) {
    const bitcoin = [
      ["unisat", "Unisat"],
      ["xverse", "Xverse"],
      ["okx", "OKX"],
    ] as const;
    const installedBitcoin = bitcoin.filter(([id]) => bitcoinWalletInstalled(id));
    const choices = connectors.filter((connector) => connector.id === "injected" || installedBitcoin.some(([id]) => id === connector.id));
    const missingBitcoin = installedBitcoin.length === 0;
    return (
      <div
        className="relative flex items-center"
        onMouseEnter={() => setHintOpen(true)}
        onMouseLeave={() => setHintOpen(false)}
        onFocus={() => setHintOpen(true)}
        onBlur={() => setHintOpen(false)}
      >
        <div className="flex items-center gap-1">
          {choices.map((connector) => (
            <Button
              key={connector.uid}
              variant="secondary"
              className={cnButton(connector.id === "injected")}
              busy={isPending}
              onClick={() => {
                setMessage(undefined);
                setHintOpen(true);
                connect({ connector }, { onError: (error) => setMessage(error.message || "The wallet request was rejected.") });
              }}
            >
              {connector.id === "injected" ? "Browser wallet" : connector.name}
            </Button>
          ))}
        </div>
        {missingBitcoin || message ? (
          <p className={`absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border border-[#163300]/15 bg-white px-3 py-2 text-right text-xs shadow-sm ${hintOpen || message ? "block" : "hidden"} ${message ? "text-danger" : "text-faint"}`}>
            {message ?? "Unisat, Xverse, and OKX are not installed in this browser."}
          </p>
        ) : null}
      </div>
    );
  }

  const wrong = chainId !== chain.id;
  const status = message ?? (switchError ? "Could not switch networks." : undefined);
  return (
    <div className="relative flex items-center gap-2">
      {wrong ? (
        <Button
          className={headerButton}
          busy={switching}
          onClick={() => {
            switchChain({ chainId: chain.id }, {
              onError: () => {
                void addAppChain().then(() => switchChain({ chainId: chain.id })).catch(() => setMessage(`The wallet could not add ${chain.name}. Add it from Settings.`));
              },
            });
          }}
        >
          Switch network
        </Button>
      ) : null}
      <span className="num inline-flex h-10 items-center rounded-full border-2 border-[#163300] bg-white px-3 text-sm font-semibold text-[#163300]">{shortAddress(address)}</span>
      <Button variant="ghost" className={`${headerButton} !px-3`} onClick={() => disconnect()}>Disconnect</Button>
      {status ? <p className="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border border-[#163300]/15 bg-white px-3 py-2 text-right text-xs text-danger shadow-sm">{status}</p> : null}
    </div>
  );
}
