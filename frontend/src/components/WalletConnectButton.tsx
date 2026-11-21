"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useBalance,
  type Connector,
} from "wagmi";
import { formatUnits } from "viem";
import { avalancheFuji } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Wallet,
  LogOut,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: balance } = useBalance({ address });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = async (connector: Connector) => {
    setErrorMsg("");
    setConnectingId(connector.id);
    try {
      await connectAsync({ connector });
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Connect error:", err);
      if (err?.name === "UserRejectedRequestError") {
        setErrorMsg("Bạn đã từ chối yêu cầu kết nối trên ví.");
      } else if (err?.message?.includes("Provider not found")) {
        setErrorMsg(
          "Không tìm thấy tiện ích ví này trên trình duyệt. Vui lòng cài đặt tiện ích mở rộng."
        );
      } else {
        setErrorMsg(err?.message || "Không thể kết nối ví. Vui lòng thử lại!");
      }
    } finally {
      setConnectingId(null);
    }
  };

  const handleSwitchNetwork = async () => {
    setErrorMsg("");
    try {
      await switchChainAsync({ chainId: avalancheFuji.id });
    } catch (err: any) {
      console.error("Switch chain error:", err);
      setErrorMsg(err?.message || "Không thể chuyển sang mạng Avalanche Fuji.");
    }
  };

  // Tránh lỗi hydration mismatch giữa Server và Client trong Next.js
  if (!mounted) {
    return (
      <Button
        disabled
        className="bg-[#E84142] text-white font-semibold gap-2 opacity-80"
      >
        <Wallet className="w-4 h-4" />
        Connect Avalanche Wallet
      </Button>
    );
  }

  // Khi chưa kết nối ví
  if (!isConnected) {
    const hasInjectedProvider = typeof window !== "undefined" && Boolean((window as any).ethereum);

    // Lọc bỏ các connector trùng lặp nếu có
    const availableConnectors = connectors.filter(
      (c, index, self) => index === self.findIndex((t) => t.id === c.id || t.name === c.name)
    );

    return (
      <>
        <Button
          onClick={() => {
            setErrorMsg("");
            setIsModalOpen(true);
          }}
          className="bg-[#E84142] hover:bg-[#c93233] text-white font-semibold gap-2 shadow-lg shadow-red-950/40"
        >
          <Wallet className="w-4 h-4" />
          Connect Avalanche Wallet
        </Button>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Wallet className="w-5 h-5 text-[#E84142]" />
                Kết nối ví Web3
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                {hasInjectedProvider
                  ? "Chọn ví bạn muốn sử dụng để tương tác với mạng Avalanche Fuji"
                  : "Chưa tìm thấy extension ví Web3 trên trình duyệt hiện tại"}
              </DialogDescription>
            </DialogHeader>

            {errorMsg && (
              <div className="bg-red-950/50 border border-red-800 text-red-300 text-xs p-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2.5 my-2">
              {hasInjectedProvider && availableConnectors.length > 0 ? (
                availableConnectors.map((connector) => {
                  const isThisConnecting = connectingId === connector.id && isPending;
                  return (
                    <Button
                      key={connector.id}
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleConnect(connector)}
                      className="w-full justify-between border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-100 h-12 px-4"
                    >
                      <span className="flex items-center gap-2.5 font-medium">
                        <ShieldCheck className="w-4 h-4 text-[#E84142]" />
                        {connector.name === "Injected"
                          ? "Ví Trình duyệt (MetaMask / Core Wallet)"
                          : connector.name}
                      </span>
                      {isThisConnecting && (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      )}
                    </Button>
                  );
                })
              ) : (
                <div className="text-center py-2 space-y-3">
                  <div className="bg-amber-950/30 border border-amber-800/50 p-3 rounded-lg text-left space-y-1.5">
                    <p className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Không tìm thấy ví Web3 (window.ethereum)
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Để tương tác và ký giao dịch nhận thưởng trên mạng Avalanche Fuji, bạn cần cài đặt một trong các tiện ích ví:
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href="https://chromewebstore.google.com/detail/core-crypto-wallet-nft-e/agoakfejjabomempkjlepdfladaackdn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-xs bg-red-950/40 hover:bg-red-900/50 p-3 rounded-lg border border-red-800/60 text-slate-100 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        🔴 Cài đặt Core Extension (Chrome Web Store)
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-red-400" />
                    </a>
                    <a
                      href="https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-xs bg-slate-900 hover:bg-slate-800 p-3 rounded-lg border border-slate-800 text-slate-200 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        🦊 Cài đặt MetaMask Extension
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  </div>

                  <div className="text-[11px] text-slate-400 text-left bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    💡 <strong>Lưu ý nếu bạn đã cài ví rồi:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
                      <li>Nếu đang dùng <em>Tab ẩn danh (Incognito)</em>, hãy cho phép extension chạy ở chế độ ẩn danh.</li>
                      <li>Đảm bảo bạn đang mở đúng cửa sổ trình duyệt có chứa tiện ích ví.</li>
                      <li>F5 lại trang sau khi bật/cài đặt ví.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Khi đã kết nối nhưng chưa chuyển sang mạng Avalanche Fuji
  if (chainId !== avalancheFuji.id) {
    return (
      <Button
        variant="destructive"
        disabled={isSwitching}
        onClick={handleSwitchNetwork}
        className="gap-2 animate-pulse bg-amber-600 hover:bg-amber-700 text-white"
      >
        {isSwitching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <AlertTriangle className="w-4 h-4" />
        )}
        Chuyển sang Avalanche Fuji
      </Button>
    );
  }

  // Khi đã kết nối thành công và đúng mạng Fuji
  return (
    <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-full text-slate-200 shadow-sm">
      <div className="text-right leading-tight">
        <div className="text-[10px] text-slate-400 font-medium">
          {balance
            ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(3)} AVAX`
            : "0.000 AVAX"}
        </div>
        <div className="text-xs font-mono font-semibold text-emerald-400">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => disconnect()}
        className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
        title="Ngắt kết nối"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
