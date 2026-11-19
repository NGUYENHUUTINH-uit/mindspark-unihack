"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/config/wagmi";
import { VAULT_ABI } from "@/config/abis";
import { Award, CheckCircle2, Sparkles, Loader2 } from "lucide-react";

interface ResultModalProps {
  open: boolean;
  onClose: () => void;
  sessionResult: {
    actualMinutes?: number;
    completedMinutes: number;
    feynmanScore: number;
    signature: `0x${string}`;
    aiFeedback: string;
    didUserSpeak?: boolean;
    stakedAmount?: string;
    bonusAmount?: string;
    vaultAddress?: string;
  } | null;
}

export function ResultModal({
  open,
  onClose,
  sessionResult,
}: ResultModalProps) {
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (!sessionResult) return null;

  const handleClaim = () => {
    writeContract({
      address: CONTRACTS.VAULT,
      abi: VAULT_ABI,
      functionName: "claimReward",
      args: [
        BigInt(sessionResult.completedMinutes),
        BigInt(sessionResult.feynmanScore),
        sessionResult.signature,
      ],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Award className="w-6 h-6 text-amber-400" />
            Proof of Cognitive Effort Verified!
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            AI Supervisor & Cryptographic Oracle đã thẩm định kết quả phiên học của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Hàng 1: Thời gian & Điểm */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400">Thời gian học tập</div>
              <div className="text-2xl font-bold text-emerald-400">
                {sessionResult.actualMinutes || 1} phút
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Quy đổi contract: {sessionResult.completedMinutes}m
              </div>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400">Điểm Feynman 30s</div>
              <div className="text-2xl font-bold text-cyan-400">
                {sessionResult.feynmanScore}/100
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {sessionResult.didUserSpeak ? "🎤 Đánh giá giọng nói thật" : "⚡ Ký duyệt nhanh (Demo)"}
              </div>
            </div>
          </div>

          {/* Hàng 2: Minh bạch dòng tiền nộp & nhận thưởng */}
          <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>💎 Minh bạch dòng tiền & Thưởng nhận được:</span>
              <span className="text-[11px] text-cyan-400 font-mono">Avalanche Fuji</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/30 p-2 rounded border border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Hoàn cọc gốc:</span>
                <span className="text-emerald-400 font-bold font-mono">+0.0100 AVAX</span>
              </div>
              <div className="bg-black/30 p-2 rounded border border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Thưởng chuyên cần:</span>
                <span className="text-amber-400 font-bold font-mono">+0.0010 AVAX</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span>Nơi lưu ký tiền: <strong className="text-slate-300">StudyStakeVault</strong></span>
              <span className="font-mono text-[10px] text-slate-400">0x62A6...5223</span>
            </div>
          </div>

          {/* Hàng 3: Đánh giá chi tiết từ AI */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-amber-400">Đánh giá từ AI: </span>
            {sessionResult.aiFeedback}
          </div>

          {/* Hàng 4: Chữ ký Oracle */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono bg-black/40 p-2 rounded">
            <span>Oracle EIP-191 Sig:</span>
            <span>{sessionResult.signature.slice(0, 24)}...</span>
          </div>
        </div>

        {isSuccess ? (
          <div className="bg-emerald-950/50 border border-emerald-700 p-4 rounded-lg text-center space-y-2.5">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold text-base">
              <CheckCircle2 className="w-5 h-5" /> Đã hoàn cọc + Nhận thưởng & Nâng cấp SBT!
            </div>
            <p className="text-xs text-slate-300">
              0.011 AVAX đã được gửi về ví của bạn trên Avalanche Fuji C-Chain.
            </p>
            <div className="flex gap-2 pt-1">
              <a
                href={`https://testnet.snowtrace.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-xs text-cyan-400 underline py-2 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800"
              >
                Xem giao dịch trên Snowtrace ↗
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-slate-700 hover:bg-slate-800 text-xs"
              >
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={handleClaim}
            disabled={isPending || isConfirming}
            className="w-full bg-gradient-to-r from-[#E84142] to-amber-600 hover:opacity-90 font-semibold gap-2 py-6 text-base"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Đang gửi xác nhận lên Avalanche Fuji...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Rút 0.01 AVAX Cọc + Nhận Thưởng & Nâng Cấp SBT
              </>
            )}
          </Button>
        )}

        {writeError && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg text-center">
            {(writeError as any).shortMessage || writeError.message || "Giao dịch không thành công"}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
