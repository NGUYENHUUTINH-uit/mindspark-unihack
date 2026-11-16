"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS } from "@/config/wagmi";
import { X402_ABI } from "@/config/abis";
import { BookOpen, Sparkles, RotateCw, Zap } from "lucide-react";

interface Flashcard {
  id: number;
  front: string;
  back: string;
}

export function FlashcardNotebook() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [cards, setCards] = useState<Flashcard[]>([
    {
      id: 1,
      front: "Proof of Cognitive Effort (PoCE) là gì?",
      back: "Cơ chế kết hợp AI giám sát tư thế học tập + Tóm tắt Feynman 30s để chứng minh nỗ lực nhận thức thực sự trên Blockchain.",
    },
    {
      id: 2,
      front: "Giao thức x402 hoạt động như thế nào?",
      back: "Chuẩn hóa mã HTTP 402 Payment Required để thực hiện vi thanh toán (micropayments) tức thì trên Avalanche Fuji.",
    },
  ]);

  const [flippedId, setFlippedId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleAskExpertX402 = async () => {
    if (!question.trim() || !address) return;
    setLoadingAi(true);
    setStatusMsg("Đang gửi yêu cầu tới AI Copilot...");

    const gatewayUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";

    try {
      // Bước 1: Gọi API lần đầu -> Sẽ nhận HTTP 402 Payment Required
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

        setStatusMsg(
          `HTTP 402: Yêu cầu vi thanh toán ${priceAvax} AVAX. Vui lòng xác nhận trên ví...`,
        );

        // Bước 2: Thanh toán vi mô on-chain qua x402PaymentRail
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
      setStatusMsg(
        `❌ Lỗi: ${err.message || "Không thể hoàn tất thanh toán x402"}`,
      );
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thanh hỏi AI tạo Flashcard qua x402 */}
      <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            AI Socratic Copilot (x402 Micropayment)
          </h3>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-400"
          >
            0.005 AVAX / Query
          </Badge>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Nhập khái niệm khó để AI giải thích & tạo Flashcard..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="bg-slate-950 border-slate-700 text-white"
          />
          <Button
            onClick={handleAskExpertX402}
            disabled={loadingAi || !address}
            className="bg-amber-600 hover:bg-amber-500 text-white shrink-0 gap-1"
          >
            <Sparkles className="w-4 h-4" />
            {loadingAi ? "Đang xử lý..." : "Hỏi AI"}
          </Button>
        </div>
        {statusMsg && <p className="text-xs text-cyan-400">{statusMsg}</p>}
      </Card>

      {/* Danh sách Flashcards */}
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const isFlipped = flippedId === card.id;
          return (
            <Card
              key={card.id}
              onClick={() => setFlippedId(isFlipped ? null : card.id)}
              className="p-5 bg-slate-900/90 border-slate-800 hover:border-[#E84142]/60 transition-all cursor-pointer min-h-[160px] flex flex-col justify-between"
            >
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {isFlipped
                    ? "Định nghĩa / Giải thích"
                    : "Câu hỏi / Khái niệm"}
                </span>
                <RotateCw className="w-3.5 h-3.5" />
              </div>

              <p
                className={`my-3 ${isFlipped ? "text-slate-200 text-sm" : "text-white font-semibold text-base"}`}
              >
                {isFlipped ? card.back : card.front}
              </p>

              <span className="text-[11px] text-slate-500">
                Nhấn vào thẻ để lật
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
