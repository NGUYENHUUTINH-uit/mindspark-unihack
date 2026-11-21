"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
  useAccount,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { avalancheFuji } from "wagmi/chains";
import { CONTRACTS } from "@/config/wagmi";
import { VAULT_ABI, X402_ABI } from "@/config/abis";
import {
  Award,
  CheckCircle2,
  Sparkles,
  Loader2,
  Mic,
  BrainCircuit,
  AlertTriangle,
  BookOpen,
  Coins,
  ShieldAlert,
  ShieldCheck,
  Rocket,
  Zap,
} from "lucide-react";

export interface ResultFlashcard {
  front: string;
  back: string;
  tag: string;
}

export interface SessionResultData {
  passed?: boolean;
  actualMinutes?: number;
  completedMinutes: number;
  feynmanScore: number; // 50-100 cho Oracle / Vault
  llmScore?: number; // 1-10 từ LLM
  signature?: `0x${string}`;
  aiFeedback: string;
  transcript?: string;
  flashcards?: ResultFlashcard[];
  didUserSpeak?: boolean;
  mode?: "voice" | "quiz" | "demo";
  oracleMock?: boolean;
  stakedAmount?: string;
  vaultAddress?: string;
}

interface ResultModalProps {
  open: boolean;
  onClose: () => void;
  sessionResult: SessionResultData | null;
  studyTopic?: string;
  focusIndex?: number;
  sbtLevel?: number;
  onRetryFeynman?: () => void;
  onSwitchToQuiz?: () => void;
  onRequestDemoAttest?: () => Promise<void>;
  onClaimSuccess?: () => void;
  onOpenNotebook?: () => void;
  onStartNewSession?: () => void;
}

interface FinalizeResponse {
  success: boolean;
  sbt?: {
    txHash?: string;
    tokenId?: string;
    skipped?: boolean;
    reason?: string;
    error?: string;
  } | null;
  stream?: {
    minutesFocused?: number;
    payoutAvax?: string;
    signature?: `0x${string}`;
    unavailable?: boolean;
    reason?: string;
    error?: string;
  } | null;
}

const CONFETTI_COLORS = ["#6E8E72", "#E84142", "#FFD700", "#00F5FF", "#f59e0b", "#10b981"];

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 24 }, (_, idx) => {
    const left = (idx * 4.1 + (idx % 3) * 2) % 98;
    const delay = (idx % 6) * 0.12;
    const duration = 1.6 + (idx % 4) * 0.3;
    const color = CONFETTI_COLORS[idx % CONFETTI_COLORS.length];
    return { idx, left, delay, duration, color };
  });

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[60]">
      <style>{`
        @keyframes mindspark-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.idx}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: "8px",
            height: "14px",
            borderRadius: "2px",
            backgroundColor: p.color,
            animation: `mindspark-confetti-fall ${p.duration}s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

export function ResultModal({
  open,
  onClose,
  sessionResult,
  studyTopic,
  focusIndex = 98,
  sbtLevel = 1,
  onRetryFeynman,
  onSwitchToQuiz,
  onRequestDemoAttest,
  onClaimSuccess,
  onOpenNotebook,
  onStartNewSession,
}: ResultModalProps) {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const {
    writeContractAsync,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: penaltyPoolWei } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "penaltyPool",
  });

  const { data: totalBountyPoolWei } = useReadContract({
    address: CONTRACTS.X402,
    abi: X402_ABI,
    functionName: "totalBountyPool",
  });

  const { data: payoutRatePerMinuteWei } = useReadContract({
    address: CONTRACTS.X402,
    abi: X402_ABI,
    functionName: "payoutRatePerMinute",
  });

  const { data: onChainOracleSigner } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "oracleSigner",
  });

  const [gatewayHealth, setGatewayHealth] = useState<{
    oracleAddress?: string;
    onChainOracleAddress?: string | null;
    oracleKeyMatchesChain?: boolean | null;
  } | null>(null);

  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [finalizeData, setFinalizeData] = useState<FinalizeResponse | null>(null);
  const [finalizeError, setFinalizeError] = useState("");
  const finalizedHashRef = useRef<string | null>(null);

  const [streamClaiming, setStreamClaiming] = useState(false);
  const [streamTxHash, setStreamTxHash] = useState<string | null>(null);
  const [streamError, setStreamError] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const gatewayUrl =
    process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";

  // Reset trạng thái giao dịch khi đóng/mở phiên mới để không bị kẹt từ lần claim trước
  useEffect(() => {
    reset();
    setFinalizeLoading(false);
    setFinalizeData(null);
    setFinalizeError("");
    finalizedHashRef.current = null;
    setStreamClaiming(false);
    setStreamTxHash(null);
    setStreamError("");
  }, [open, sessionResult, reset]);

  // Pháo hoa Confetti khi đạt Proof hoặc Claim on-chain thành công
  useEffect(() => {
    if (open && (sessionResult?.passed !== false || isSuccess)) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2600);
      return () => clearTimeout(t);
    }
    setShowConfetti(false);
  }, [open, isSuccess, sessionResult?.passed]);

  // Kiểm tra ví Oracle đang chạy trên API Gateway có khớp oracleSigner() on-chain không
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`${gatewayUrl}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setGatewayHealth({
            oracleAddress: data.oracleAddress,
            onChainOracleAddress: data.onChainOracleAddress ?? null,
            oracleKeyMatchesChain: data.oracleKeyMatchesChain ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setGatewayHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, gatewayUrl]);

  // Sau khi claimReward() xác nhận trên Fuji -> gọi /api/v1/session/finalize để nâng cấp SBT & xin chữ ký stream x402
  useEffect(() => {
    if (!isSuccess || !txHash || finalizedHashRef.current === txHash) return;
    finalizedHashRef.current = txHash;

    async function runFinalize() {
      setFinalizeLoading(true);
      setFinalizeError("");
      try {
        const res = await fetch(`${gatewayUrl}/api/v1/session/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Không thể finalize phiên học");
        }
        setFinalizeData(data);
        onClaimSuccess?.();
      } catch (err: any) {
        setFinalizeError(err?.message || "Gateway finalize tạm thời gián đoạn.");
        onClaimSuccess?.();
      } finally {
        setFinalizeLoading(false);
      }
    }

    runFinalize();
  }, [isSuccess, txHash, gatewayUrl, onClaimSuccess]);

  if (!sessionResult) return null;

  const isPassed = sessionResult.passed !== false && Boolean(sessionResult.signature);
  const passedWithoutSig = sessionResult.passed !== false && !sessionResult.signature;
  const gatewayOracleAddr = gatewayHealth?.oracleAddress;
  const effectiveChainOracle =
    (typeof onChainOracleSigner === "string" ? onChainOracleSigner : null) ||
    gatewayHealth?.onChainOracleAddress ||
    null;
  const oracleMismatch = Boolean(
    (effectiveChainOracle &&
      gatewayOracleAddr &&
      effectiveChainOracle.toLowerCase() !== gatewayOracleAddr.toLowerCase()) ||
      gatewayHealth?.oracleKeyMatchesChain === false
  );
  const isMockSig =
    sessionResult.oracleMock ||
    (sessionResult.signature && sessionResult.signature === "0x" + "00".repeat(65));

  // Tính thưởng dự kiến từ penaltyPool thực tế của Vault & học bổng x402
  const maxBonusWei = parseEther("0.01");
  const zeroWei = BigInt(0);
  const penaltyPoolDisplay = penaltyPoolWei
    ? Number(formatEther(penaltyPoolWei)).toFixed(4)
    : "0.0000";
  const tenPercentPoolWei =
    penaltyPoolWei && penaltyPoolWei > zeroWei ? penaltyPoolWei / BigInt(10) : zeroWei;
  const estimatedBonusWei =
    tenPercentPoolWei > maxBonusWei ? maxBonusWei : tenPercentPoolWei;
  const estimatedBonusFormatted = Number(formatEther(estimatedBonusWei)).toFixed(4);

  const xpEarned = Math.max(
    50,
    sessionResult.completedMinutes * 2 + sessionResult.feynmanScore
  );
  const effectiveRateWei = payoutRatePerMinuteWei ?? parseEther("0.0001");
  const estimatedX402Wei = BigInt(sessionResult.completedMinutes) * effectiveRateWei;
  const estimatedX402Avax = Number(formatEther(estimatedX402Wei)).toFixed(4);
  const bountyPoolAvax = totalBountyPoolWei
    ? Number(formatEther(totalBountyPoolWei)).toFixed(4)
    : "0.0000";

  const handleClaim = async () => {
    if (!sessionResult.signature) return;
    try {
      let freshNonce: number | undefined = undefined;
      if (publicClient && address) {
        try {
          freshNonce = await publicClient.getTransactionCount({
            address,
            blockTag: "pending",
          });
        } catch (e) {
          console.warn("Could not fetch fresh nonce, fallback to default", e);
        }
      }

      await writeContractAsync({
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "claimReward",
        args: [
          BigInt(sessionResult.completedMinutes),
          BigInt(sessionResult.feynmanScore),
          sessionResult.signature,
        ],
        account: address,
        chainId: avalancheFuji.id,
        ...(freshNonce !== undefined ? { nonce: freshNonce } : {}),
      });
    } catch (err: any) {
      console.error("Claim error:", err);
    }
  };

  const handleClaimStream = async () => {
    const stream = finalizeData?.stream;
    if (!stream?.signature || !stream.minutesFocused) return;
    setStreamClaiming(true);
    setStreamError("");
    try {
      let freshNonce: number | undefined = undefined;
      if (publicClient && address) {
        try {
          freshNonce = await publicClient.getTransactionCount({
            address,
            blockTag: "pending",
          });
        } catch {
          // fallback mặc định
        }
      }
      const hash = await writeContractAsync({
        address: CONTRACTS.X402,
        abi: X402_ABI,
        functionName: "claimStreamPayout",
        args: [BigInt(stream.minutesFocused), stream.signature],
        account: address,
        chainId: avalancheFuji.id,
        ...(freshNonce !== undefined ? { nonce: freshNonce } : {}),
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setStreamTxHash(hash);
      onClaimSuccess?.();
    } catch (err: any) {
      setStreamError(err?.shortMessage || err?.message || "Chưa hoàn tất claim x402 stream");
    } finally {
      setStreamClaiming(false);
    }
  };

  const handleDemoFastTrack = async () => {
    if (!onRequestDemoAttest) return;
    setDemoLoading(true);
    try {
      await onRequestDemoAttest();
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <>
      <ConfettiBurst active={showConfetti} />
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-slate-950 border-slate-800 text-white">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold">
              {isPassed ? (
                <>
                  <Award className="w-7 h-7 text-amber-400" />
                  Chúc Mừng! Phiên Học Đã Được Xác Thực On-Chain
                </>
              ) : passedWithoutSig ? (
                <>
                  <AlertTriangle className="w-7 h-7 text-amber-400" />
                  Đã vượt qua bài kiểm tra — Thiếu chữ ký Oracle
                </>
              ) : (
                <>
                  <ShieldAlert className="w-7 h-7 text-rose-400" />
                  Chưa đạt chuẩn xác thực AI
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              {isPassed
                ? `Chủ đề: ${studyTopic?.trim() || "Kiến thức tổng hợp phiên học"} — AI Supervisor & Cryptographic Oracle đã cấp chữ ký EIP-191.`
                : passedWithoutSig
                  ? "Bài Quiz vừa chạy ở chế độ Offline dự phòng (hoặc AI Service chưa trả Proof). Hãy thử tạo lại Quiz online hoặc nói Feynman 30s để nhận chữ ký Oracle rút cọc."
                  : "Hệ thống Anti-Cheat yêu cầu nội dung phản tư rõ ràng (≥ 15 từ, không lặp từ/nói nhảm) hoặc hoàn thành Quiz."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-2 items-start">
            {/* CỘT TRÁI: HUY HIỆU 3D & CHỈ SỐ THÀNH TÍCH */}
            <div className="md:col-span-5 space-y-4">
              <div
                className={`relative rounded-3xl p-6 border overflow-hidden text-center space-y-4 ${
                  isPassed
                    ? "bg-gradient-to-br from-slate-900 via-[#14201c] to-slate-950 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.12)]"
                    : "bg-slate-900/90 border-rose-500/40"
                }`}
              >
                <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-tr from-[#6E8E72] via-emerald-400 to-amber-300 p-1 shadow-xl">
                  <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center">
                    {isPassed ? (
                      <ShieldCheck className="w-10 h-10 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-10 h-10 text-rose-400" />
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-semibold">
                    MindSpark Scholar SBT • Lv.{sbtLevel}
                  </span>
                  <div className="mt-1 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-bold text-base">
                    <Zap className="w-4 h-4" />
                    {isPassed ? `+${xpEarned} EXP Thưởng` : "+0 EXP (Chưa đạt)"}
                  </div>
                  {isPassed && (
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                      Cộng tiến độ lên cấp SBT (Lv.1 → Lv.5) để mở khóa quà tại Reward Marketplace
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="bg-black/40 p-3 rounded-2xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">Thời gian học</div>
                    <div className="text-xl font-bold text-emerald-400">
                      {sessionResult.actualMinutes || 1} phút
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Vault: {sessionResult.completedMinutes}m
                    </div>
                  </div>
                  <div className="bg-black/40 p-3 rounded-2xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">
                      {sessionResult.mode === "quiz" ? "Điểm Quiz AI" : "Điểm Feynman"}
                    </div>
                    <div
                      className={`text-xl font-bold ${
                        isPassed ? "text-cyan-400" : "text-rose-400"
                      }`}
                    >
                      {sessionResult.llmScore !== undefined
                        ? `${sessionResult.llmScore}/10`
                        : `${sessionResult.feynmanScore}/100`}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Oracle {sessionResult.feynmanScore}/100
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-black/30 border border-slate-800/80">
                  <span className="text-slate-400">Focus Index Edge-AI</span>
                  <span className="font-bold text-emerald-300">{focusIndex}%</span>
                </div>
              </div>

              {isPassed && sessionResult.signature && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
                  <span>Oracle EIP-191:</span>
                  <span>
                    {sessionResult.signature.slice(0, 18)}...
                    {isMockSig ? " (MOCK)" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* CỘT PHẢI: MINH BẠCH 3 LUỒNG THƯỞNG + ĐÁNH GIÁ AI + CLAIM */}
            <div className="md:col-span-7 space-y-4">
              {isPassed && (
                <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="text-sm font-bold text-slate-200 flex items-center justify-between">
                    <span>💎 Chi tiết 3 luồng Hoàn cọc & Điểm thưởng</span>
                    <span className="text-xs text-cyan-400 font-mono">Avalanche Fuji</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="bg-black/35 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-200">
                          1. Hoàn cọc + Quỹ phạt (StudyStakeVault)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {penaltyPoolWei && penaltyPoolWei > zeroWei
                            ? `Quỹ phạt hiện có ${penaltyPoolDisplay} AVAX — chia 10% thưởng người chăm chỉ`
                            : "Quỹ phạt Penalty Pool đang 0.0000 AVAX (chưa có người bỏ cuộc)"}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className="text-emerald-400 font-bold">+0.0100 AVAX</div>
                        <div className="text-[11px] text-amber-400">
                          +{estimatedBonusFormatted} Bonus
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/35 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-200">
                          2. Học bổng kỷ luật x402 (x402PaymentRail)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sessionResult.completedMinutes}p × 0.0001 AVAX/phút • Bounty Pool: {bountyPoolAvax} AVAX
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono font-bold text-cyan-400">
                        +{estimatedX402Avax} AVAX
                      </div>
                    </div>

                    <div className="bg-black/35 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-200">
                          3. Điểm kinh nghiệm &amp; Huy hiệu SBT (StudyBadgeSBT)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Cộng +{sessionResult.completedMinutes}p vào SBT on-chain (Lv.1→5, Oracle tài trợ 100% gas) để đổi voucher &amp; học bổng ở Reward Marketplace
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-bold text-amber-300">
                        +{xpEarned} EXP
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sessionResult.transcript && (
                <div className="bg-slate-900/75 p-4 rounded-2xl border border-slate-800 text-sm text-slate-300 space-y-1.5">
                  <div className="font-semibold text-emerald-400 text-xs">
                    🎙️ Nội dung Feynman đã ghi nhận:
                  </div>
                  <p className="italic text-slate-300 leading-relaxed text-xs sm:text-sm">
                    &ldquo;{sessionResult.transcript}&rdquo;
                  </p>
                </div>
              )}

              <div className="bg-slate-900/75 p-4 rounded-2xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
                <span className="font-semibold text-amber-400">Đánh giá từ AI: </span>
                {sessionResult.aiFeedback}
              </div>

              {sessionResult.flashcards && sessionResult.flashcards.length > 0 && (
                <div className="bg-emerald-950/25 border border-emerald-800/40 p-4 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      Đã lưu {sessionResult.flashcards.length} Flashcard mới vào Sổ tay
                    </span>
                    {onOpenNotebook && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenNotebook();
                        }}
                        className="text-xs text-cyan-400 hover:underline cursor-pointer font-semibold"
                      >
                        Mở Sổ tay ↗
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">
                    <strong>Q:</strong> {sessionResult.flashcards[0].front}
                  </p>
                </div>
              )}

              {/* KHU VỰC HÀNH ĐỘNG */}
              {!isPassed ? (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    {onRetryFeynman && (
                      <Button
                        onClick={() => {
                          onClose();
                          onRetryFeynman();
                        }}
                        className="bg-[#6E8E72] hover:bg-[#5d7a61] text-white gap-2 py-5 text-sm rounded-2xl"
                      >
                        <Mic className="w-4 h-4" /> Thu âm lại 30s
                      </Button>
                    )}
                    {onSwitchToQuiz && (
                      <Button
                        onClick={() => {
                          onClose();
                          onSwitchToQuiz();
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white gap-2 py-5 text-sm rounded-2xl"
                      >
                        <BrainCircuit className="w-4 h-4" /> Làm Quiz 5 câu
                      </Button>
                    )}
                  </div>

                  {onRequestDemoAttest && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={demoLoading}
                      onClick={handleDemoFastTrack}
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-900 text-xs"
                    >
                      {demoLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                      )}
                      [Demo Fast-Track] Xin chữ ký mẫu từ Gateway (cần bật ENABLE_DEMO_ATTEST)
                    </Button>
                  )}
                </div>
              ) : isSuccess ? (
                <div className="bg-emerald-950/50 border border-emerald-700 p-5 rounded-2xl text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-base">
                    <CheckCircle2 className="w-5 h-5" /> Đã hoàn 0.01 AVAX cọc + Xác nhận trên Fuji!
                  </div>

                  {finalizeLoading && (
                    <div className="text-xs text-cyan-300 flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang tự động nâng cấp Huy hiệu Soulbound NFT & kiểm tra x402 Stream...
                    </div>
                  )}

                  {finalizeData?.sbt && (
                    <div className="text-xs bg-black/35 p-2.5 rounded-xl border border-emerald-800/60 text-slate-200">
                      {finalizeData.sbt.txHash ? (
                        <span>
                          🎖️ Đã nâng cấp <strong>Soulbound Badge #{finalizeData.sbt.tokenId}</strong> (+{xpEarned} EXP) on-chain!{" "}
                          <a
                            href={`https://testnet.snowtrace.io/tx/${finalizeData.sbt.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 underline"
                          >
                            Tx ↗
                          </a>
                        </span>
                      ) : finalizeData.sbt.skipped ? (
                        <span>🎖️ SBT đã ghi nhận cho giao dịch này (+{xpEarned} EXP).</span>
                      ) : (
                        <span className="text-amber-300">
                          ⚠️ SBT chưa tự động ghi: {finalizeData.sbt.error}
                        </span>
                      )}
                    </div>
                  )}

                  {finalizeData?.stream?.signature && !streamTxHash && (
                    <Button
                      size="sm"
                      disabled={streamClaiming}
                      onClick={handleClaimStream}
                      className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-sm py-5 rounded-xl gap-2"
                    >
                      {streamClaiming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Coins className="w-4 h-4" />
                      )}
                      Nhận thêm Học bổng x402 (+{finalizeData.stream.payoutAvax} AVAX)
                    </Button>
                  )}

                  {finalizeData?.stream?.unavailable && (
                    <div className="text-[11px] text-slate-300 bg-black/25 p-2 rounded-lg">
                      ℹ️ Học bổng x402 Stream: {finalizeData.stream.reason}
                    </div>
                  )}

                  {streamTxHash && (
                    <div className="text-xs text-cyan-300">
                      ⚡ Đã nhận học bổng x402 Stream!{" "}
                      <a
                        href={`https://testnet.snowtrace.io/tx/${streamTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Xem Tx ↗
                      </a>
                    </div>
                  )}

                  {finalizeError && (
                    <div className="text-xs text-amber-300">{finalizeError}</div>
                  )}
                  {streamError && (
                    <div className="text-xs text-rose-300">{streamError}</div>
                  )}

                  <p className="text-xs text-emerald-200/90">
                    Cọc đã hoàn về ví — bạn có thể bắt đầu phiên học tiếp theo bất kỳ lúc nào!
                  </p>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <Button
                      onClick={() => {
                        if (onStartNewSession) onStartNewSession();
                        else onClose();
                      }}
                      className="flex-1 bg-[#6E8E72] hover:bg-[#5d7a61] text-white font-semibold py-5 rounded-xl gap-2"
                    >
                      <Rocket className="w-4 h-4" /> Bắt đầu phiên học mới
                    </Button>
                    <a
                      href={`https://testnet.snowtrace.io/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 text-xs text-cyan-400 underline flex items-center justify-center bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800"
                    >
                      Snowtrace ↗
                    </a>
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="border-slate-700 hover:bg-slate-800 text-xs px-4 py-5 rounded-xl"
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {oracleMismatch && (
                    <div className="text-xs text-rose-200 bg-rose-950/60 border border-rose-500/50 p-3.5 rounded-2xl space-y-1.5 leading-relaxed">
                      <div className="font-bold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Cảnh báo lệch ví Oracle — Rút cọc sẽ bị từ chối!
                      </div>
                      <div className="font-mono text-[11px] space-y-0.5 text-rose-100/90">
                        <div>
                          • API Gateway đang ký bằng: {gatewayOracleAddr?.slice(0, 10)}...{gatewayOracleAddr?.slice(-4)}
                        </div>
                        <div>
                          • StudyStakeVault on-chain yêu cầu: {effectiveChainOracle?.slice(0, 10)}...{effectiveChainOracle?.slice(-4)}
                        </div>
                      </div>
                      <p className="text-[11px] text-rose-200/90">
                        Giao dịch <code>claimReward()</code> sẽ revert <code>Invalid Oracle signature</code>. Hãy đặt <code>ORACLE_PRIVATE_KEY</code> khớp ví{" "}
                        <span className="font-mono">{effectiveChainOracle}</span> trong{" "}
                        <code>contracts/.env</code> rồi khởi động lại API Gateway (<code>node services/apiGateway.js</code>).
                      </p>
                    </div>
                  )}
                  {isMockSig && (
                    <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-700/60 p-2.5 rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Chữ ký hiện tại là MOCK (ORACLE_MOCK=true) — hợp đồng trên Fuji sẽ từ chối nếu gửi tx thật.
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={handleClaim}
                    disabled={isPending || isConfirming}
                    className="w-full bg-gradient-to-r from-[#E84142] to-amber-600 hover:opacity-90 font-semibold gap-2 py-6 text-base rounded-2xl"
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
                </div>
              )}

              {writeError && (
                <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-3 rounded-xl text-center">
                  {(writeError as any).shortMessage ||
                    writeError.message ||
                    "Giao dịch không thành công"}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
