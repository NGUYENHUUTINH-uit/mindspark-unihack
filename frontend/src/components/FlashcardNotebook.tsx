"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS } from "@/config/wagmi";
import { X402_ABI } from "@/config/abis";
import { Sparkles, RotateCw, Feather, Loader2 } from "lucide-react";

interface Flashcard {
  id: number;
  tag: string;
  front: string;
  back: string;
}

export function FlashcardNotebook() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [cards, setCards] = useState<Flashcard[]>([
    {
      id: 1,
      tag: "Core Concept",
      front: "Proof of Cognitive Effort (PoCE) hoạt động như thế nào?",
      back: "Kết hợp thị giác máy tính (MediaPipe) giám sát tư thế học tập và phân tích giọng nói Feynman 30s để xác thực nỗ lực nhận thức thực sự lên Blockchain.",
    },
    {
      id: 2,
      tag: "x402 Protocol",
      front: "Tại sao MindSpark dùng chuẩn HTTP 402 trên Avalanche?",
      back: "Cho phép dòng tiền vi thanh toán (micropayments) chảy tự động từ quỹ tài trợ về ví sinh viên theo từng phút học mà không cần trung gian.",
    },
  ]);

  const [flippedId, setFlippedId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleAskExpertX402 = async () => {
    if (!question.trim() || !address) return;
    setLoadingAi(true);
    setStatusMsg("Đang kết nối AI Socratic Copilot...");

    const gatewayUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";

    try {
      const res1 = await fetch(`${gatewayUrl}/api/v1/ai/ask-expert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-address": address,
        },
        body: JSON.stringify({ question, studentAddress: address }),
      });

      if (res1.status === 402) {
        const challenge = await res1.json();
        const { queryHash, priceAvax } = challenge.paymentInstructions;

        setStatusMsg(`Mở khóa câu trả lời chuyên sâu (${priceAvax} AVAX)...`);

        await writeContractAsync({
          address: CONTRACTS.X402,
          abi: X402_ABI,
          functionName: "payForAiQuery",
          args: [queryHash as `0x${string}`],
          value: parseEther(priceAvax),
        });

        setStatusMsg(
          "Đã gửi giao dịch! Đang đợi xác nhận block trên Avalanche Fuji...",
        );

        // Bước 3: Gọi lại API kèm Header X-402-Query-Hash (thử tối đa 4 lần để đợi block mined trên Fuji)
        let data: any = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
          await new Promise((r) => setTimeout(r, attempt === 1 ? 2500 : 1500));
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
        }

        if (data && data.success && data.copilotAnswer?.flashcardSuggestion) {
          setCards((prev) => [
            {
              id: Date.now(),
              tag: "AI Generated • x402",
              front: data.copilotAnswer.flashcardSuggestion.front,
              back: data.copilotAnswer.flashcardSuggestion.back,
            },
            ...prev,
          ]);
          setQuestion("");
          setStatusMsg("✅ Đã tạo Flashcard mới từ AI Expert!");
        } else {
          setStatusMsg("⚠️ Đã gửi thanh toán nhưng RPC Fuji đang xử lý. Vui lòng thử bấm lại sau vài giây.");
        }
      }
    } catch (err: any) {
      setStatusMsg(`Chưa hoàn tất: ${err.message || "Giao dịch bị hủy"}`);
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Khung hỏi AI Socratic */}
      <div className="bg-[#FCFBF7] border border-[#E5DFD3] rounded-3xl p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-[#2D2620]">
            <Feather className="w-3.5 h-3.5 text-[#6E8E72]" /> Trợ lý chắt lọc
            kiến thức Socratic
          </span>
          <span className="px-3 py-1 rounded-full bg-[#F3EFE6] text-[#6E8E72] font-medium">
            0.005 AVAX / lượt hỏi
          </span>
        </div>

        <div className="flex gap-2.5">
          <input
            placeholder="Đặt một câu hỏi khó để AI giải mã thành thẻ ghi nhớ..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskExpertX402()}
            className="flex-1 bg-[#F5F2EA] border border-[#E5DFD3] text-[#2D2620] placeholder:text-[#9A9084] text-sm px-4 h-11 rounded-full focus:outline-none focus:border-[#6E8E72]"
          />
          <button
            onClick={handleAskExpertX402}
            disabled={loadingAi || !address}
            className="bg-[#6E8E72] hover:bg-[#5d7a61] disabled:opacity-50 text-white text-xs font-medium h-11 px-5 rounded-full shrink-0 flex items-center gap-2 transition-all"
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
          <p className="text-xs text-[#6E8E72] pl-2">{statusMsg}</p>
        )}
      </div>

      {/* Danh sách thẻ Flashcard */}
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const isFlipped = flippedId === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setFlippedId(isFlipped ? null : card.id)}
              className={`rounded-3xl p-6 min-h-[190px] flex flex-col justify-between cursor-pointer transition-all border ${
                isFlipped
                  ? "bg-[#F3EFE6] border-[#6E8E72]/40"
                  : "bg-[#FCFBF7] border-[#E5DFD3] hover:border-[#6E8E72]/60 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#8C8275] font-medium">
                <span>{isFlipped ? "Giải mã" : card.tag}</span>
                <RotateCw className="w-3.5 h-3.5" />
              </div>

              <p
                className={`my-3 leading-relaxed ${isFlipped ? "text-[#4A423A] text-sm" : "text-[#2D2620] text-base font-semibold"}`}
              >
                {isFlipped ? card.back : card.front}
              </p>

              <span className="text-[11px] text-[#9A9084]">
                Chạm vào thẻ để lật
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
