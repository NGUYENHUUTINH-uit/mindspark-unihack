"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useBalance,
} from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";

export function WalletConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });

  if (!isConnected) {
    return (
      <Button
        onClick={() => connect({ connector: connectors[0] })}
        className="bg-[#E84142] hover:bg-[#c93233] text-white font-semibold gap-2"
      >
        <Wallet className="w-4 h-4" />
        Connect Avalanche Wallet
      </Button>
    );
  }

  if (chainId !== avalancheFuji.id) {
    return (
      <Button
        variant="destructive"
        onClick={() => switchChain({ chainId: avalancheFuji.id })}
        className="gap-2 animate-pulse"
      >
        <AlertTriangle className="w-4 h-4" />
        Switch to Avalanche Fuji
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
      <div className="text-right">
        <div className="text-xs text-slate-400">
          {balance
            ? `${Number(balance.formatted).toFixed(3)} AVAX`
            : "0.000 AVAX"}
        </div>
        <div className="text-sm font-mono text-emerald-400">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => disconnect()}
        title="Ngắt kết nối"
      >
        <LogOut className="w-4 h-4 text-slate-400 hover:text-red-400" />
      </Button>
    </div>
  );
}
