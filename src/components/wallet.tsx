"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { bitcoinWalletInstalled } from "@/lib/chain/bitcoin-wallets";
import { addAppChain, getAppChain } from "@/lib/chain/config";
import { shortAddress } from "@/lib/escrow/format";
import { Button } from "@/components/ui";

export function WalletControls() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string>();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const chain = getAppChain();

  useEffect(() => setReady(true), []);

  if (!ready) return <Button variant="secondary" disabled>Connect wallet</Button>;

  if (!isConnected) {
    const bitcoin = [
      ["unisat", "Unisat"],
      ["xverse", "Xverse"],
      ["okx", "OKX"],
    ] as const;
    const installedBitcoin = bitcoin.filter(([id]) => bitcoinWalletInstalled(id));
    const choices = connectors.filter((connector) => connector.id === "injected" || installedBitcoin.some(([id]) => id === connector.id));
    return (
      <div className="flex flex-col items-stretch gap-1 sm:items-end">
        <div className="flex flex-wrap justify-end gap-1">
          {choices.map((connector) => (
            <Button
              key={connector.uid}
              variant="secondary"
              className={connector.id === "injected" ? "!border-transparent !bg-meadow !text-brand hover:!bg-[#8fdf55]" : undefined}
              busy={isPending}
              onClick={() => {
                setMessage(undefined);
                connect({ connector }, { onError: (error) => setMessage(error.message || "The wallet request was rejected.") });
              }}
            >
              {connector.id === "injected" ? "Browser wallet" : connector.name}
            </Button>
          ))}
        </div>
        {installedBitcoin.length === 0 ? <p className="max-w-64 text-right text-xs text-faint">Unisat, Xverse, and OKX are not installed in this browser.</p> : null}
        {message ? <p className="max-w-64 text-xs text-danger">{message}</p> : null}
      </div>
    );
  }

  const wrong = chainId !== chain.id;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {wrong ? (
          <Button
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
        <span className="num rounded-full border-2 border-[#163300] bg-white px-3 py-1.5 text-sm font-semibold text-[#163300]">{shortAddress(address)}</span>
        <Button variant="ghost" className="!px-3" onClick={() => disconnect()}>Disconnect</Button>
      </div>
      {message ? <p className="max-w-64 text-right text-xs text-danger">{message}</p> : null}
      {switchError && !message ? <p className="max-w-64 text-right text-xs text-danger">Could not switch networks.</p> : null}
    </div>
  );
}
