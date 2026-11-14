"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS } from "@/config/wagmi";
import { VAULT_ABI, SBT_ABI } from "@/config/abis";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { FlashcardNotebook } from "@/components/FlashcardNotebook";
import { ResultModal } from "@/components/ResultModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Camera,
  Mic,
  Play,
  Square,
  ShieldCheck,
  Coins,
} from "lucide-react";

export default function MindSparkApp() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Trạng thái Pomodoro & AI Supervisor
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isStudying, setIsStudying] = useState(false);
  const [isRecordingFeynman, setIsRecordingFeynman] = useState(false);
  const [feynmanSeconds, setFeynmanSeconds] = useState(30);
  const [aiStatus, setAiStatus] = useState<"focused" | "distracted">("focused");
  const [bountyPool, setBountyPool] = useState("0.0000");

  // Modal Kết quả
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionResult, setSessionResult] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Đọc dữ liệu Huy hiệu Soulbound NFT (Token ID #1 demo)
  const { data: badgeMetrics } = useReadContract({
    address: CONTRACTS.SBT,
    abi: SBT_ABI,
    functionName: "badgeMetrics",
    args: [BigInt(1)],
  });

  // Lấy số dư quỹ tài trợ x402 Bounty Pool từ API Gateway
  useEffect(() => {
    const gatewayUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";
    fetch(`${gatewayUrl}/api/v1/x402/bounty-pool`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setBountyPool(data.totalBountyPoolAvax);
      })
      .catch(() => {});
  }, []);

  // Bật Webcam khi vào chế độ học
  useEffect(() => {
    if (isStudying && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => console.warn("Không truy cập được Webcam"));
    } else if (!isStudying && videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  }, [isStudying]);

  // Đếm ngược đồng hồ Pomodoro
  useEffect(() => {
    if (!isStudying) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsStudying(false);
          setIsRecordingFeynman(true); // Chuyển sang bước ghi âm Feynman 30s
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isStudying]);

  // Đếm ngược 30s ghi âm Feynman Reflection
  useEffect(() => {
    if (!isRecordingFeynman) return;
    const timer = setInterval(() => {
      setFeynmanSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishFeynman();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecordingFeynman]);

  // Bắt đầu phiên học: Stake 0.01 AVAX vào Vault
  const handleStartSession = async () => {
    if (!isConnected) return alert("Vui lòng kết nối ví Avalanche Fuji trước!");
    try {
      await writeContractAsync({
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "stakeForSession",
        args: [BigInt(targetMinutes)],
        value: parseEther("0.01"),
      });
      setSecondsLeft(targetMinutes * 60);
      setIsStudying(true);
    } catch (err) {
      console.error("Lỗi Stake:", err);
    }
  };

  // Hoàn tất Feynman 30s -> Gọi Oracle Attest để lấy chữ ký nhận thưởng
  const handleFinishFeynman = async () => {
    setIsRecordingFeynman(false);
    setFeynmanSeconds(30);

    // Chữ ký mẫu hoặc gọi qua backend của TV2 để lấy chữ ký thật từ Oracle
    setSessionResult({
      completedMinutes: targetMinutes,
      feynmanScore: 92,
      signature:
        "0x8f3a9c2b1e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
      aiFeedback:
        "Tư thế học tập chuẩn xác 98%. Phần giải thích Feynman mạch lạc, nắm vững bản chất thuật toán đồng thuận Avalanche.",
    });
    setModalOpen(true);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const sbtLevel = badgeMetrics ? Number(badgeMetrics[0]) : 1;
  const sbtMinutes = badgeMetrics ? Number(badgeMetrics[1]) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#E84142] flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">MindSpark</h1>
              <p className="text-[11px] text-slate-400">
                Proof of Cognitive Effort on Avalanche
              </p>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="focus" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="focus">🎯 Pomodoro Focus Room</TabsTrigger>
            <TabsTrigger value="dashboard">
              🎖️ SBT Skill Tree & Dashboard
            </TabsTrigger>
            <TabsTrigger value="flashcards">
              📒 Sổ tay Flashcard (x402)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: POMODORO FOCUS ROOM */}
          <TabsContent value="focus">
            <div className="grid md:grid-cols-12 gap-6">
              {/* Cột trái: Đồng hồ & Stake */}
              <Card className="md:col-span-7 p-6 bg-slate-900 border-slate-800 flex flex-col items-center justify-center space-y-6">
                <div className="flex gap-2">
                  {[1, 25, 50].map((mins) => (
                    <Button
                      key={mins}
                      variant={targetMinutes === mins ? "default" : "outline"}
                      size="sm"
                      disabled={isStudying}
                      onClick={() => {
                        setTargetMinutes(mins);
                        setSecondsLeft(mins * 60);
                      }}
                      className={
                        targetMinutes === mins
                          ? "bg-[#E84142]"
                          : "border-slate-700"
                      }
                    >
                      {mins === 1 ? "1 Phút (Demo)" : `${mins} Phút`}
                    </Button>
                  ))}
                </div>

                <div className="text-7xl font-mono font-bold tracking-wider text-white">
                  {formatTime(secondsLeft)}
                </div>

                {isRecordingFeynman ? (
                  <div className="w-full bg-amber-950/40 border border-amber-500/50 p-4 rounded-xl text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold animate-pulse">
                      <Mic className="w-5 h-5" /> Đang ghi âm Feynman Reflection
                      ({feynmanSeconds}s)
                    </div>
                    <p className="text-xs text-slate-300">
                      Hãy tóm tắt lại kiến thức bạn vừa học bằng ngôn ngữ đơn
                      giản nhất!
                    </p>
                    <Progress
                      value={((30 - feynmanSeconds) / 30) * 100}
                      className="h-2"
                    />
                    <Button
                      size="sm"
                      onClick={handleFinishFeynman}
                      className="bg-amber-600"
                    >
                      Nộp bài sớm & Chấm điểm AI
                    </Button>
                  </div>
                ) : !isStudying ? (
                  <Button
                    size="lg"
                    onClick={handleStartSession}
                    className="bg-[#E84142] hover:bg-[#c93233] text-white px-8 gap-2 text-base"
                  >
                    <Play className="w-5 h-5" /> Stake 0.01 AVAX & Bắt đầu học
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsStudying(false);
                        setIsRecordingFeynman(true);
                      }}
                      className="border-emerald-600 text-emerald-400"
                    >
                      Hoàn thành sớm → Nói Feynman 30s
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setIsStudying(false)}
                      className="gap-1"
                    >
                      <Square className="w-4 h-4" /> Hủy phiên
                    </Button>
                  </div>
                )}
              </Card>

              {/* Cột phải: Edge-AI Camera Monitor */}
              <Card className="md:col-span-5 p-4 bg-slate-900 border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-400" /> AI Pose &
                    Distraction Guard
                  </span>
                  <Badge
                    className={
                      aiStatus === "focused" ? "bg-emerald-600" : "bg-red-600"
                    }
                  >
                    {aiStatus === "focused"
                      ? "Tập trung tốt"
                      : "Phát hiện điện thoại!"}
                  </Badge>
                </div>

                <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-slate-800 flex items-center justify-center">
                  {isStudying ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <p className="text-xs text-slate-500">
                      Camera sẽ tự bật khi bắt đầu phiên Stake
                    </p>
                  )}
                </div>

                {/* Nút giả lập cảnh báo cầm điện thoại để test nhanh khi Pitching */}
                {isStudying && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setAiStatus(
                        aiStatus === "focused" ? "distracted" : "focused",
                      )
                    }
                    className="w-full text-xs text-slate-400"
                  >
                    [Demo Toggle] Giả lập cầm điện thoại / Tập trung
                  </Button>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: DASHBOARD & SOULBOUND NFT */}
          <TabsContent value="dashboard">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 bg-slate-900 border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    Dynamic Soulbound SBT
                  </span>
                  <ShieldCheck className="w-5 h-5 text-[#E84142]" />
                </div>
                <div className="text-3xl font-bold text-amber-400">
                  Level {sbtLevel}
                </div>
                <p className="text-xs text-slate-400">
                  Huy hiệu On-Chain SVG tự động nâng cấp màu sắc theo số phút
                  tích lũy ({sbtMinutes} phút).
                </p>
              </Card>

              <Card className="p-6 bg-slate-900 border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    x402 Sponsor Bounty Pool
                  </span>
                  <Coins className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-400">
                  {bountyPool} AVAX
                </div>
                <p className="text-xs text-slate-400">
                  Quỹ học bổng tài trợ tự động giải ngân theo từng phút học được
                  Oracle xác thực.
                </p>
              </Card>

              <Card className="p-6 bg-slate-900 border-slate-800 space-y-3">
                <span className="text-sm text-slate-400">
                  Tỷ lệ dòng chảy x402
                </span>
                <div className="text-3xl font-bold text-cyan-400">
                  0.0001 AVAX/phút
                </div>
                <p className="text-xs text-slate-400">
                  Thanh toán vi mô trực tiếp về ví sinh viên qua hợp đồng
                  x402PaymentRail.
                </p>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: SỔ TAY FLASHCARD */}
          <TabsContent value="flashcards">
            <FlashcardNotebook />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Kết quả & Claim */}
      <ResultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sessionResult={sessionResult}
      />
    </div>
  );
}
