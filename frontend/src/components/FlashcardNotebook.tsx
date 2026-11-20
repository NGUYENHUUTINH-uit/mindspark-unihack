"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS } from "@/config/wagmi";
import { X402_ABI } from "@/config/abis";
import { Sparkles, RotateCw, Feather, Loader2, CheckCircle2 } from "lucide-react";

export interface NotebookFlashcard {
  id: number;
  tag: string;
  front: string;
  back: string;
}

export const DEFAULT_FLASHCARDS: NotebookFlashcard[] = [
  {
    id: 1,
    tag: "Core Concept",
    front: "Proof of Cognitive Effort (PoCE) hoạt động như thế nào?",
    back: "Kết hợp thị giác máy tính (MediaPipe Edge-AI) giám sát tư thế học tập và phân tích giọng nói Feynman 30s để xác thực nỗ lực nhận thức thực sự lên Blockchain.",
  },
  {
    id: 2,
    tag: "x402 Protocol",
    front: "Tại sao MindSpark dùng chuẩn HTTP 402 trên Avalanche?",
    back: "Cho phép dòng tiền vi thanh toán (micropayments) chảy hai chiều: doanh nghiệp stream học bổng theo phút và sinh viên trả vi mô theo từng câu hỏi AI.",
  },
];

interface FlashcardNotebookProps {
  darkMode?: boolean;
  cards?: NotebookFlashcard[];
  onAddCard?: (card: Omit<NotebookFlashcard, "id">) => void;
}

export function FlashcardNotebook({
  darkMode = false,
  cards: externalCards,
  onAddCard,
}: FlashcardNotebookProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [internalCards, setInternalCards] = useState<NotebookFlashcard[]>(DEFAULT_FLASHCARDS);
  const cards = externalCards ?? internalCards;

  const [flippedId, setFlippedId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [latestAnswer, setLatestAnswer] = useState<{
    topic: string;
    explanation: string;
    txHash?: string;
  } | null>(null);

  const addNewCard = (card: Omit<NotebookFlashcard, "id">) => {
    if (onAddCard) {
      onAddCard(card);
    } else {
      setInternalCards((prev) => [{ id: Date.now(), ...card }, ...prev]);
    }
  };

  const handleAskExpertX402 = async () => {
    if (!question.trim() || !address) return;
    setLoadingAi(true);
    setStatusMsg("Đang khởi tạo thử thách HTTP 402...");
    setLatestAnswer(null);

    const gatewayUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";

    try {
      // Bước 1: Gọi Gateway -> Nhận HTTP 402 Payment Required
      const res1 = await fetch(`${gatewayUrl}/api/v1/ai/ask-expert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-address": address,
        },
        body: JSON.stringify({ question, studentAddress: address }),
      });

      if (res1.status !== 402) {
        if (res1.ok) {
          const directData = await res1.json();
          if (directData.copilotAnswer?.flashcardSuggestion) {
            addNewCard({
              tag: `AI • ${directData.copilotAnswer.topic || "x402"}`,
              front: directData.copilotAnswer.flashcardSuggestion.front,
              back: directData.copilotAnswer.flashcardSuggestion.back,
            });
            setLatestAnswer({
              topic: directData.copilotAnswer.topic,
              explanation: directData.copilotAnswer.explanation,
            });
            setQuestion("");
            setStatusMsg("✅ Đã tạo Flashcard mới từ AI Expert!");
            return;
          }
        }
        throw new Error(`Gateway trả mã không mong đợi (${res1.status})`);
      }

      const challenge = await res1.json();
      const { queryHash, priceAvax } = challenge.paymentInstructions;

      setStatusMsg(`HTTP 402: Xác nhận thanh toán ${priceAvax} AVAX trên ví...`);

      // Bước 2: Thanh toán vi mô on-chain qua x402PaymentRail
      const txHash = await writeContractAsync({
        address: CONTRACTS.X402,
        abi: X402_ABI,
        functionName: "payForAiQuery",
        args: [queryHash as `0x${string}`],
        value: parseEther(priceAvax),
      });

      setStatusMsg("⏳ Đang đợi Avalanche Fuji xác nhận block (waitForTransactionReceipt)...");

      // Chờ giao dịch thực sự được mined on-chain rồi mới mở khóa AI
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        await new Promise((r) => setTimeout(r, 3000));
      }

      setStatusMsg("🔓 Đã xác nhận on-chain! Gemini AI đang giải mã câu trả lời...");

      // Bước 3: Gọi lại API kèm Header x-402-query-hash (Gateway tự gọi AI Service /api/copilot/ask)
      let data: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res2 = await fetch(`${gatewayUrl}/api/v1/ai/ask-expert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-student-address": address,
            "x-402-query-hash": queryHash,
          },
          body: JSON.stringify({ question, studentAddress: address }),
        });

        if (res2.ok) {
          data = await res2.json();
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (data && data.success && data.copilotAnswer?.flashcardSuggestion) {
        addNewCard({
          tag: `x402 • ${data.copilotAnswer.topic || "AI Copilot"}`,
          front: data.copilotAnswer.flashcardSuggestion.front,
          back: data.copilotAnswer.flashcardSuggestion.back,
        });
        setLatestAnswer({
          topic: data.copilotAnswer.topic || "AI Socratic Copilot",
          explanation: data.copilotAnswer.explanation,
          txHash,
        });
        setQuestion("");
        setStatusMsg("✅ Đã tạo Flashcard mới từ Gemini AI qua giao thức x402!");
      } else {
        setStatusMsg(
          "⚠️ Giao dịch đã ghi nhận on-chain nhưng RPC/AI phản hồi chậm. Vui lòng thử lại sau vài giây."
        );
      }
    } catch (err: any) {
      if (
        err?.name === "UserRejectedRequestError" ||
        err?.message?.includes("User rejected")
      ) {
        setStatusMsg("Đã hủy thanh toán trên ví.");
      } else {
        setStatusMsg(`Chưa hoàn tất: ${err?.shortMessage || err?.message || "Lỗi kết nối"}`);
      }
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Khung hỏi AI Socratic */}
      <div
        className={`rounded-3xl p-6 border shadow-sm space-y-3 transition-colors ${
          darkMode
            ? "bg-[#211F1D] border-white/10 text-[#F3EFE6]"
            : "bg-[#FCFBF7] border-[#E5DFD3] text-[#2D2620]"
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold">
            <Feather className="w-3.5 h-3.5 text-[#6E8E72]" /> Trợ lý chắt lọc kiến thức Socratic (Gemini AI)
          </span>
          <span
            className={`px-3 py-1 rounded-full font-medium ${
              darkMode
                ? "bg-[#6E8E72]/20 text-emerald-300"
                : "bg-[#F3EFE6] text-[#6E8E72]"
            }`}
          >
            0.005 AVAX / lượt hỏi (x402)
          </span>
        </div>

        <div className="flex gap-2.5">
          <input
            placeholder={
              address
                ? "Đặt một câu hỏi khó để AI giải mã thành thẻ ghi nhớ..."
                : "Hãy kết nối ví Avalanche để dùng trợ lý x402..."
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskExpertX402()}
            className={`flex-1 border text-sm px-4 h-11 rounded-full focus:outline-none focus:border-[#6E8E72] transition-colors ${
              darkMode
                ? "bg-[#181715] border-white/10 text-[#F3EFE6] placeholder:text-stone-500"
                : "bg-[#F5F2EA] border-[#E5DFD3] text-[#2D2620] placeholder:text-[#9A9084]"
            }`}
          />
          <button
            onClick={handleAskExpertX402}
            disabled={loadingAi || !address || !question.trim()}
            className="bg-[#6E8E72] hover:bg-[#5d7a61] disabled:opacity-50 text-white text-xs font-medium h-11 px-5 rounded-full shrink-0 flex items-center gap-2 transition-all cursor-pointer"
          >
            {loadingAi ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loadingAi ? "Đang xử lý" : "Tạo thẻ AI"}
          </button>
        </div>

        {statusMsg && (
          <p className="text-xs text-[#6E8E72] pl-2 font-medium">{statusMsg}</p>
        )}

        {latestAnswer && (
          <div
            className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
              darkMode
                ? "bg-[#181715] border-emerald-500/30 text-stone-200"
                : "bg-emerald-50/70 border-emerald-600/25 text-[#2D2620]"
            }`}
          >
            <div className="flex items-center justify-between font-semibold text-[#6E8E72]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Giải đáp Socratic: {latestAnswer.topic}
              </span>
              {latestAnswer.txHash && (
                <a
                  href={`https://testnet.snowtrace.io/tx/${latestAnswer.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] underline text-cyan-600 dark:text-cyan-400"
                >
                  Snowtrace Tx ↗
                </a>
              )}
            </div>
            <p className="leading-relaxed opacity-90">{latestAnswer.explanation}</p>
          </div>
        )}
      </div>

      {/* Danh sách thẻ Flashcard dạng Lật 3D (MU-23) */}
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const isFlipped = flippedId === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setFlippedId(isFlipped ? null : card.id)}
              className="min-h-[200px] cursor-pointer group"
              style={{ perspective: "1000px" }}
            >
              <div
                className="relative w-full h-full min-h-[200px] transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Mặt trước (Câu hỏi) */}
                <div
                  className={`absolute inset-0 rounded-3xl p-6 flex flex-col justify-between border shadow-sm ${
                    darkMode
                      ? "bg-[#211F1D] border-white/10 text-[#F3EFE6] group-hover:border-[#6E8E72]/60"
                      : "bg-[#FCFBF7] border-[#E5DFD3] text-[#2D2620] group-hover:border-[#6E8E72]/60"
                  }`}
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div
                    className={`flex items-center justify-between text-[11px] uppercase tracking-wider font-medium ${
                      darkMode ? "text-stone-400" : "text-[#8C8275]"
                    }`}
                  >
                    <span className="truncate pr-2">{card.tag}</span>
                    <RotateCw className="w-3.5 h-3.5 shrink-0" />
                  </div>

                  <p className="my-3 leading-relaxed text-base font-semibold">
                    {card.front}
                  </p>

                  <span
                    className={`text-[11px] ${
                      darkMode ? "text-stone-500" : "text-[#9A9084]"
                    }`}
                  >
                    Chạm vào thẻ để lật 3D
                  </span>
                </div>

                {/* Mặt sau (Giải mã / Đáp án) */}
                <div
                  className={`absolute inset-0 rounded-3xl p-6 flex flex-col justify-between border shadow-sm ${
                    darkMode
                      ? "bg-[#1B221C] border-[#6E8E72]/50 text-[#EAE4D7]"
                      : "bg-[#F3EFE6] border-[#6E8E72]/45 text-[#4A423A]"
                  }`}
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-[#6E8E72]">
                    <span>Giải mã</span>
                    <RotateCw className="w-3.5 h-3.5 shrink-0" />
                  </div>

                  <p className="my-3 leading-relaxed text-sm">{card.back}</p>

                  <span
                    className={`text-[11px] ${
                      darkMode ? "text-stone-400" : "text-[#8C8275]"
                    }`}
                  >
                    Chạm lại để xem câu hỏi
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
