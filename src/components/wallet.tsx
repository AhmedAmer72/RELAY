"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
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
    return (
      <div className="flex flex-col items-stretch gap-1 sm:items-end">
        <Button
          variant="secondary"
          className="!border-transparent !bg-meadow !text-brand hover:!bg-[#8fdf55]"
          busy={isPending}
          onClick={() => {
            setMessage(undefined);
            const connector = connectors[0];
            if (!connector) {
              setMessage("No injected wallet was found. Install a wallet that supports custom networks, then refresh.");
              return;
            }
            connect({ connector }, { onError: () => setMessage("The wallet request was rejected or no injected wallet was found.") });
          }}
        >
          Connect wallet
        </Button>
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
