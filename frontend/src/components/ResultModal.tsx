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
    completedMinutes: number;
    feynmanScore: number;
    signature: `0x${string}`;
    aiFeedback: string;
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
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Award className="w-6 h-6 text-amber-400" />
            Proof of Cognitive Effort Verified!
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            AI Supervisor & Cryptographic Oracle đã xác nhận phiên học của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400">Thời gian tập trung</div>
              <div className="text-2xl font-bold text-emerald-400">
                {sessionResult.completedMinutes} phút
              </div>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400">Điểm Feynman 30s</div>
              <div className="text-2xl font-bold text-cyan-400">
                {sessionResult.feynmanScore}/100
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-sm text-slate-300">
            <span className="font-semibold text-amber-400">
              Đánh giá từ AI:{" "}
            </span>
            {sessionResult.aiFeedback}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 font-mono bg-black/40 p-2 rounded">
            <span>Oracle Sig:</span>
            <span>{sessionResult.signature.slice(0, 18)}...</span>
          </div>
        </div>

        {isSuccess ? (
          <div className="bg-emerald-950/50 border border-emerald-700 p-3 rounded-lg text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-5 h-5" /> Đã nhận thưởng & Nâng cấp
              SBT!
            </div>
            <a
              href={`https://testnet.snowtrace.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 underline block"
            >
              Xem giao dịch trên Snowtrace ↗
            </a>
          </div>
        ) : (
          <Button
            onClick={handleClaim}
            disabled={isPending || isConfirming}
            className="w-full bg-gradient-to-r from-[#E84142] to-amber-600 hover:opacity-90 font-semibold gap-2"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang xác nhận trên
                Avalanche...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Claim Stake + Bounty & Upgrade
                SBT
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
