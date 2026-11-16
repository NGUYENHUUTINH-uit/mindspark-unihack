"use client";

import { formatUnits } from "viem"; // <-- Thêm dòng này ở đầu file
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useBalance,
} from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";

export function WalletConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });

  const handleConnect = () => {
    // Kiểm tra xem trình duyệt đã cài ví Web3 chưa
    if (typeof window !== "undefined" && !(window as any).ethereum) {
      alert(
        "Trình duyệt chưa cài đặt ví Web3! Vui lòng cài tiện ích Core Wallet hoặc MetaMask.",
      );
      window.open("https://core.app/", "_blank");
      return;
    }

    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={isPending}
        className="px-4 py-2 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] text-white text-xs font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer"
      >
        <Wallet className="w-3.5 h-3.5" />
        {isPending ? "Đang mở ví..." : "Connect Wallet"}
      </button>
    );
  }

  if (chainId !== avalancheFuji.id) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: avalancheFuji.id })}
        className="px-4 py-2 rounded-full bg-rose-600 text-white text-xs font-medium flex items-center gap-1.5 animate-pulse cursor-pointer"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Switch to Fuji
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5 bg-[#F3EFE6] border border-[#E5DFD3] px-3.5 py-1.5 rounded-full">
      <div className="text-right leading-tight">
        <div className="text-[10px] text-[#7A7167]">
          {balance
            ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(3)} AVAX`
            : "0.000 AVAX"}
        </div>
        <div className="text-xs font-mono font-semibold text-[#2D2620]">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => disconnect()}
        className="p-1 text-[#7A7167] hover:text-rose-600 transition-colors cursor-pointer"
        title="Ngắt kết nối"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
