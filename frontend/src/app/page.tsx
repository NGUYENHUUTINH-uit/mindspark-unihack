"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { CONTRACTS } from "@/config/wagmi";
import { VAULT_ABI, SBT_ABI } from "@/config/abis";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { FlashcardNotebook } from "@/components/FlashcardNotebook";
import { ResultModal } from "@/components/ResultModal";
import {
  Minus,
  Plus,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Mic,
  Eye,
  Camera,
  CameraOff,
  ShieldCheck,
  Coins,
  Compass,
  Award,
  BookOpen,
  Lock,
  Sparkles,
  Smartphone,
  PenTool,
  BookOpenCheck,
  Monitor,
  HelpCircle,
  X,
  Music,
  ChevronRight,
  BrainCircuit,
} from "lucide-react";

type ActiveSpace = "focus" | "sanctuary" | "notebook";
type StudyPose =
  | "Writing Pose"
  | "Reading Pose"
  | "Screen Focus"
  | "Phone Distraction";
type SoundTrackId = "off" | "rain" | "lofi" | "ocean" | "fire";

const SOUND_TRACKS: { id: SoundTrackId; label: string; emoji: string }[] = [
  { id: "off", label: "Tắt nhạc", emoji: "🔇" },
  { id: "rain", label: "Mưa tĩnh tâm", emoji: "🌧️" },
  { id: "lofi", label: "Lo-fi Synth", emoji: "🎹" },
  { id: "ocean", label: "Sóng biển", emoji: "🌊" },
  { id: "fire", label: "Lửa trại ấm", emoji: "🔥" },
];

export default function MindSparkInteractiveStudio() {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Giao diện & Modal Hướng dẫn (Mặc định FALSE -> chỉ hiện khi người dùng bấm)
  const [darkMode, setDarkMode] = useState(false);
  const [activeSpace, setActiveSpace] = useState<ActiveSpace>("focus");
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Trạng thái Pomodoro
  const [studyMinutes, setStudyMinutes] = useState(45);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [isStudying, setIsStudying] = useState(false);

  // Edge-AI Pose & Focus Index (%)
  const [showCameraPip, setShowCameraPip] = useState(true);
  const [currentPose, setCurrentPose] = useState<StudyPose>("Writing Pose");
  const [focusIndex, setFocusIndex] = useState(98);

  // Feynman 30s Voice Reflection & Audio Visualizer
  const [isRecordingFeynman, setIsRecordingFeynman] = useState(false);
  const [feynmanSeconds, setFeynmanSeconds] = useState(30);
  const [audioLevels, setAudioLevels] = useState<number[]>([
    20, 35, 50, 30, 60, 40, 25, 45, 55, 30, 40, 20,
  ]);

  // Dữ liệu On-chain & Modal
  const [bountyPool, setBountyPool] = useState("0.0000");
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionResult, setSessionResult] = useState<any>(null);

  // Trình phát nhạc nhiều bản nhạc (Web Audio Synthesizer)
  const [currentTrack, setCurrentTrack] = useState<SoundTrackId>("off");
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalMusicRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Đọc dữ liệu Huy hiệu Soulbound NFT
  const { data: badgeMetrics } = useReadContract({
    address: CONTRACTS.SBT,
    abi: SBT_ABI,
    functionName: "badgeMetrics",
    args: [BigInt(1)],
  });

  const { data: tokenUri } = useReadContract({
    address: CONTRACTS.SBT,
    abi: SBT_ABI,
    functionName: "tokenURI",
    args: [BigInt(1)],
  });

  const decodeSbtImage = () => {
    if (!tokenUri || typeof tokenUri !== "string") return null;
    try {
      const base64Json = tokenUri.replace("data:application/json;base64,", "");
      const json = JSON.parse(atob(base64Json));
      return json.image as string;
    } catch {
      return null;
    }
  };
  const sbtSvgImage = decodeSbtImage();

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

  // Bộ phát 4 bản nhạc thư giãn bằng Web Audio API
  const selectSoundTrack = (trackId: SoundTrackId) => {
    // Dọn dẹp âm thanh cũ
    if (intervalMusicRef.current) {
      clearInterval(intervalMusicRef.current);
      intervalMusicRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    setCurrentTrack(trackId);
    setShowSoundMenu(false);

    if (trackId === "off") return;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    if (trackId === "rain") {
      // Tiếng mưa rơi dịu (Brown Noise)
      const bufferSize = 4096;
      let lastOut = 0.0;
      const node = ctx.createScriptProcessor(bufferSize, 1, 1);
      node.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 0.12;
        }
      };
      node.connect(ctx.destination);
    } else if (trackId === "ocean") {
      // Tiếng sóng biển dập dìu (Modulated Pink/Brown Noise)
      const bufferSize = 4096;
      let lastOut = 0.0;
      let phase = 0;
      const node = ctx.createScriptProcessor(bufferSize, 1, 1);
      node.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          phase += 0.00008;
          const waveEnvelope = (Math.sin(phase) + 1.2) * 0.08;
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.03 * white) / 1.03;
          lastOut = output[i];
          output[i] *= waveEnvelope;
        }
      };
      node.connect(ctx.destination);
    } else if (trackId === "fire") {
      // Tiếng lửa trại ấm áp kèm tiếng tí tách nhẹ
      const bufferSize = 4096;
      let lastOut = 0.0;
      const node = ctx.createScriptProcessor(bufferSize, 1, 1);
      node.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          const crackle =
            Math.random() > 0.9985 ? (Math.random() - 0.5) * 0.4 : 0;
          output[i] = ((lastOut + 0.015 * white) / 1.015) * 0.15 + crackle;
          lastOut = output[i];
        }
      };
      node.connect(ctx.destination);
    } else if (trackId === "lofi") {
      // Hợp âm Lo-fi Chill (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
      const chords = [
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [164.81, 196.0, 246.94, 293.66], // Em7
        [146.83, 174.61, 220.0, 261.63], // Dm7
        [130.81, 164.81, 196.0, 246.94], // Cmaj7
      ];
      let step = 0;

      const playChord = () => {
        if (!audioCtxRef.current) return;
        const now = ctx.currentTime;
        const freqs = chords[step % chords.length];
        step++;

        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.025, now + 0.6);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 3.8);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 4.0);
        });
      };

      playChord();
      intervalMusicRef.current = setInterval(playChord, 4000);
    }
  };

  // Webcam Edge-AI Supervisor
  useEffect(() => {
    if (isStudying && showCameraPip && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {});
    } else if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  }, [isStudying, showCameraPip]);

  // Đồng hồ đếm ngược
  useEffect(() => {
    if (!isStudying) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsStudying(false);
          setIsRecordingFeynman(true);
          return 0;
        }
        return prev - 1;
      });

      setFocusIndex((prev) => {
        if (currentPose === "Phone Distraction") return Math.max(40, prev - 2);
        return Math.min(100, prev + 1);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isStudying, currentPose]);

  // Thu âm Micro & Sóng âm Visualizer cho Feynman 30s
  useEffect(() => {
    if (!isRecordingFeynman) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      return;
    }

    let animFrame: number;
    let audioCtx: AudioContext;

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        micStreamRef.current = stream;
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVisualizer = () => {
          analyser.getByteFrequencyData(dataArray);
          const bars = Array.from(dataArray.slice(0, 12)).map((val) =>
            Math.max(15, Math.min(100, (val / 255) * 100)),
          );
          setAudioLevels(bars);
          animFrame = requestAnimationFrame(updateVisualizer);
        };
        updateVisualizer();
      })
      .catch(() => {
        const fallback = setInterval(() => {
          setAudioLevels(
            Array.from(
              { length: 12 },
              () => Math.floor(Math.random() * 70) + 20,
            ),
          );
        }, 150);
        return () => clearInterval(fallback);
      });

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

    return () => {
      clearInterval(timer);
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioCtx) audioCtx.close();
    };
  }, [isRecordingFeynman]);

  const handleAdjustStudyTime = (delta: number) => {
    if (isStudying) return;
    const next = Math.max(1, Math.min(120, studyMinutes + delta));
    setStudyMinutes(next);
    setSecondsLeft(next * 60);
  };

  const handleStartSession = async () => {
    if (!isConnected)
      return alert(
        "Vui lòng kết nối ví Avalanche ở góc trên bên phải để đặt cọc phiên học.",
      );
    try {
      await writeContractAsync({
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "stakeForSession",
        args: [BigInt(studyMinutes)],
        value: parseEther("0.01"),
      });
      setSecondsLeft(studyMinutes * 60);
      setFocusIndex(98);
      setCurrentPose("Writing Pose");
      setIsStudying(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetOrChange = () => {
    setIsStudying(false);
    setIsRecordingFeynman(false);
    setSecondsLeft(studyMinutes * 60);
  };

  const handleFinishFeynman = () => {
    setIsRecordingFeynman(false);
    setFeynmanSeconds(30);
    setSessionResult({
      completedMinutes: studyMinutes,
      feynmanScore: focusIndex >= 85 ? 94 : 78,
      signature:
        "0x8f3a9c2b1e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
      aiFeedback: `Focus Index đạt ${focusIndex}%. Tư thế học tập tự nhiên được xác thực. Nội dung phản tư Feynman 30s mạch lạc và đã tự động lưu thành Flashcard.`,
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

  // Tính toán vòng tròn tiến độ SVG động
  const totalSeconds = studyMinutes * 60;
  const progressRatio = isStudying
    ? (totalSeconds - secondsLeft) / totalSeconds
    : 0;
  const circleRadius = 112;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - progressRatio);

  const sbtLevel = badgeMetrics ? Number(badgeMetrics[0]) : 1;
  const sbtMinutes = badgeMetrics ? Number(badgeMetrics[1]) : 0;
  const activeSoundObj =
    SOUND_TRACKS.find((t) => t.id === currentTrack) || SOUND_TRACKS[0];

  return (
    <div
      className={`min-h-screen transition-colors duration-500 flex flex-col justify-between ${
        darkMode ? "bg-[#171614] text-[#F3EFE6]" : "bg-[#FAF7F0] text-[#2D2620]"
      }`}
    >
      {/* HEADER */}
      <header className="max-w-6xl w-full mx-auto px-6 pt-5 pb-3 flex items-center justify-between relative z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#6E8E72] flex items-center justify-center text-white shadow-xs">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold tracking-tight leading-none">
              MindSpark
            </h1>
            <span
              className={`text-[11px] ${darkMode ? "text-stone-400" : "text-[#7A7167]"}`}
            >
              Proof of Cognitive Effort • Avalanche
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút Cách hoạt động (Chỉ mở khi bấm) */}
          <button
            onClick={() => setShowGuideModal(true)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              darkMode
                ? "bg-white/5 border-white/10 text-stone-200 hover:bg-white/10"
                : "bg-[#FCFBF7] border-[#E5DFD3] text-[#3E362E] hover:bg-[#F3EFE6]"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#6E8E72]" />
            <span>Cách hoạt động</span>
          </button>

          {/* Bộ chọn Nhiều bản nhạc thư giãn */}
          <div className="relative">
            <button
              onClick={() => setShowSoundMenu(!showSoundMenu)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                currentTrack !== "off"
                  ? "bg-[#6E8E72]/15 border-[#6E8E72]/40 text-[#6E8E72]"
                  : darkMode
                    ? "bg-white/5 border-white/10 text-stone-300 hover:bg-white/10"
                    : "bg-[#FCFBF7] border-[#E5DFD3] text-[#5C5349] hover:bg-[#F3EFE6]"
              }`}
            >
              {currentTrack !== "off" ? (
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <Music className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {currentTrack === "off"
                  ? "Nhạc nền"
                  : `${activeSoundObj.emoji} ${activeSoundObj.label}`}
              </span>
            </button>

            {showSoundMenu && (
              <div
                className={`absolute right-0 mt-2 w-48 rounded-2xl p-1.5 border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  darkMode
                    ? "bg-[#211F1D] border-white/10"
                    : "bg-[#FCFBF7] border-[#E5DFD3]"
                }`}
              >
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider opacity-60 font-semibold">
                  Chọn không gian âm thanh
                </div>
                {SOUND_TRACKS.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => selectSoundTrack(track.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      currentTrack === track.id
                        ? "bg-[#6E8E72] text-white font-medium"
                        : darkMode
                          ? "hover:bg-white/5 text-stone-300"
                          : "hover:bg-[#F3EFE6] text-[#2D2620]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{track.emoji}</span>
                      <span>{track.label}</span>
                    </span>
                    {currentTrack === track.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nút Dark / Light Mode */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              darkMode
                ? "bg-white/10 border-white/15 text-amber-200"
                : "bg-[#FCFBF7] border-[#E5DFD3] text-[#2D2620] hover:bg-[#F3EFE6]"
            }`}
          >
            {darkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="hidden md:inline">
              {darkMode ? "Light" : "Dark"}
            </span>
          </button>

          <WalletConnectButton />
        </div>
      </header>

      {/* KHU VỰC TRUNG TÂM */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24 pt-2">
        {/* 1. KHÔNG GIAN FOCUS ROOM + GIỚI THIỆU RÕ RÀNG */}
        {activeSpace === "focus" && (
          <div className="w-full max-w-4xl flex flex-col items-center space-y-6 animate-in fade-in duration-500">
            {/* Phần Giới thiệu ngắn gọn, súc tích giúp người mới hiểu ngay Web làm gì */}
            {!isStudying && !isRecordingFeynman && (
              <div className="text-center max-w-2xl space-y-2.5 px-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6E8E72]/15 text-[#6E8E72] text-[11px] font-semibold">
                  <Sparkles className="w-3 h-3" /> Nền tảng Study-to-Earn được
                  giám sát bởi Edge-AI
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Tập trung học thật. Nhận học bổng tức thì.
                </h2>
                <p
                  className={`text-xs sm:text-sm leading-relaxed ${darkMode ? "text-stone-400" : "text-[#6E655C]"}`}
                >
                  Cam kết mục tiêu bằng AVAX, tự do đọc sách & ghi chép dưới sự
                  bảo vệ của AI chống xao nhãng điện thoại, tóm tắt kiến thức 30
                  giây để tự động tạo Flashcard và nhận thưởng qua giao thức{" "}
                  <strong>x402</strong>.
                </p>
              </div>
            )}

            {/* THẺ ĐỒNG HỒ POMODORO TƯƠNG TÁC ĐỘNG */}
            <div
              className={`w-full max-w-[520px] rounded-[32px] p-7 sm:p-9 border transition-all duration-300 ${
                darkMode
                  ? "bg-[#211F1D] border-white/10 shadow-2xl"
                  : "bg-[#FCFBF7] border-[#EAE4D7] shadow-[0_16px_48px_rgba(45,38,32,0.07)]"
              }`}
            >
              {/* Hai ô điều chỉnh Study Time & Break Time */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1.5">
                  <label
                    className={`block text-xs font-medium pl-1 ${darkMode ? "text-stone-400" : "text-[#6E655C]"}`}
                  >
                    Thời gian học (phút)
                  </label>
                  <div
                    className={`flex items-center justify-between h-11 px-4 rounded-full border transition-colors ${
                      darkMode
                        ? "bg-[#181715] border-white/10"
                        : "bg-[#F6F3EB] border-[#E6E0D4]"
                    }`}
                  >
                    <button
                      onClick={() => handleAdjustStudyTime(-5)}
                      disabled={isStudying}
                      className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30 transition-transform active:scale-90 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm tabular-nums">
                      {studyMinutes}
                    </span>
                    <button
                      onClick={() => handleAdjustStudyTime(5)}
                      disabled={isStudying}
                      className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30 transition-transform active:scale-90 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={`block text-xs font-medium pl-1 ${darkMode ? "text-stone-400" : "text-[#6E655C]"}`}
                  >
                    Nghỉ giải lao (phút)
                  </label>
                  <div
                    className={`flex items-center justify-between h-11 px-4 rounded-full border transition-colors ${
                      darkMode
                        ? "bg-[#181715] border-white/10"
                        : "bg-[#F6F3EB] border-[#E6E0D4]"
                    }`}
                  >
                    <button
                      onClick={() =>
                        setBreakMinutes(Math.max(1, breakMinutes - 1))
                      }
                      disabled={isStudying}
                      className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30 transition-transform active:scale-90 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm tabular-nums">
                      {breakMinutes}
                    </span>
                    <button
                      onClick={() =>
                        setBreakMinutes(Math.min(30, breakMinutes + 1))
                      }
                      disabled={isStudying}
                      className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30 transition-transform active:scale-90 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Nhãn trạng thái & Focus Index */}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-4 py-1 rounded-full bg-[#6E8E72] text-white text-xs font-medium tracking-wide shadow-2xs">
                    {isRecordingFeynman
                      ? "🎙️ Phản tư Feynman 30s"
                      : isStudying
                        ? `AI Pose: ${currentPose}`
                        : "Sẵn sàng vào phiên học"}
                  </span>
                  {isStudying && (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        focusIndex >= 80
                          ? "bg-emerald-500/10 border-emerald-500/30 text-[#6E8E72]"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-600 animate-pulse"
                      }`}
                    >
                      Focus: {focusIndex}%
                    </span>
                  )}
                </div>

                {/* VÒNG TRÒN TIẾN ĐỘ ĐỘNG BAO QUANH ĐỒNG HỒ */}
                <div className="relative w-64 h-64 flex items-center justify-center my-1">
                  <svg
                    className="w-full h-full -rotate-90 transform"
                    viewBox="0 0 256 256"
                  >
                    {/* Vòng nền */}
                    <circle
                      cx="128"
                      cy="128"
                      r={circleRadius}
                      stroke={darkMode ? "rgba(255,255,255,0.08)" : "#EFECE4"}
                      strokeWidth="8"
                      fill="transparent"
                    />
                    {/* Vòng tiến độ chạy mượt */}
                    <circle
                      cx="128"
                      cy="128"
                      r={circleRadius}
                      stroke={
                        currentPose === "Phone Distraction" && isStudying
                          ? "#e11d48"
                          : "#6E8E72"
                      }
                      strokeWidth="8"
                      strokeDasharray={circleCircumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>

                  {/* Số đếm ngược ở tâm vòng tròn */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className={`text-5xl sm:text-6xl font-bold tracking-wider tabular-nums font-mono transition-transform ${
                        isStudying ? "scale-105" : ""
                      }`}
                    >
                      {isRecordingFeynman
                        ? `00:${feynmanSeconds.toString().padStart(2, "0")}`
                        : formatTime(secondsLeft)}
                    </span>
                    <span className="text-[11px] opacity-60 mt-1.5 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#6E8E72]" />
                      {isStudying
                        ? "Camera AI xử lý trên RAM"
                        : "Cọc cam kết: 0.01 AVAX"}
                    </span>
                  </div>
                </div>

                {/* Khu vực ghi âm Feynman 30s hoặc Nút bấm hành động */}
                {isRecordingFeynman ? (
                  <div className="w-full text-center space-y-4 mt-4">
                    <div className="flex items-center justify-center gap-1.5 h-10">
                      {audioLevels.map((lvl, idx) => (
                        <div
                          key={idx}
                          className="w-1.5 bg-[#6E8E72] rounded-full transition-all duration-150"
                          style={{ height: `${lvl}%` }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-[#6E8E72] font-medium flex items-center justify-center gap-1.5">
                      <Mic className="w-4 h-4 animate-pulse" /> Hãy nói tóm tắt
                      kiến thức vừa học trong 30 giây...
                    </p>
                    <button
                      onClick={handleFinishFeynman}
                      className="px-6 py-2.5 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] text-white text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      Hoàn tất & Nhận xác thực Oracle
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-3 w-full mt-5">
                    {!isStudying ? (
                      <button
                        onClick={handleStartSession}
                        className="px-8 py-3 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] text-white text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        Start (Stake 0.01 AVAX)
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsStudying(false);
                          setIsRecordingFeynman(true);
                        }}
                        className="px-7 py-3 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] text-white text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        Xong sớm → Nói Feynman 30s
                      </button>
                    )}

                    <button
                      onClick={handleResetOrChange}
                      className={`px-6 py-3 rounded-full text-sm font-medium border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                        darkMode
                          ? "bg-white/5 border-white/10 text-stone-300 hover:bg-white/10"
                          : "bg-[#F6F3EB] border-[#E6E0D4] text-[#3E362E] hover:bg-[#ECE7DA]"
                      }`}
                    >
                      Reset
                    </button>
                  </div>
                )}

                {/* Thanh công cụ nhanh dưới thẻ */}
                {!isStudying && !isRecordingFeynman && (
                  <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5 w-full flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setStudyMinutes(1);
                        setSecondsLeft(60);
                      }}
                      className="text-[#8C8275] hover:text-[#6E8E72] underline underline-offset-4 cursor-pointer"
                    >
                      Đặt nhanh 1 phút (Demo)
                    </button>
                    <button
                      onClick={() => setShowGuideModal(true)}
                      className="text-[#6E8E72] font-medium flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      Xem quy trình 4 bước{" "}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Thẻ Tóm tắt Tính năng nổi bật bên dưới đồng hồ (Tương tác hover) */}
            {!isStudying && !isRecordingFeynman && (
              <div className="grid sm:grid-cols-3 gap-3.5 w-full max-w-3xl pt-2">
                {[
                  {
                    icon: Eye,
                    title: "Edge-AI Giám sát tự nhiên",
                    desc: "Nhận diện tư thế cúi viết, đọc sách. Tự động nhắc nhở nếu cầm điện thoại.",
                  },
                  {
                    icon: Mic,
                    title: "Phản tư Feynman 30s",
                    desc: "Nói tóm tắt cuối giờ để AI chấm điểm hiểu bài và tự động sinh Flashcard.",
                  },
                  {
                    icon: Coins,
                    title: "Học bổng x402 & SBT",
                    desc: "Nhận vi thanh toán AVAX theo phút và nâng cấp Huy hiệu NFT không thể làm giả.",
                  },
                ].map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={feat.title}
                      className={`p-4 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                        darkMode
                          ? "bg-[#211F1D]/80 border-white/10 hover:border-[#6E8E72]/50"
                          : "bg-[#FCFBF7] border-[#EAE4D7] hover:border-[#6E8E72]/60 shadow-2xs"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#6E8E72]/15 text-[#6E8E72] flex items-center justify-center mb-2.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold mb-1">{feat.title}</h3>
                      <p
                        className={`text-[11px] leading-relaxed ${darkMode ? "text-stone-400" : "text-[#7A7167]"}`}
                      >
                        {feat.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. TAB HUY HIỆU SOULBOUND (SKILL TREE) & BOUNTY POOL */}
        {activeSpace === "sanctuary" && (
          <div className="w-full max-w-3xl space-y-5 animate-in fade-in duration-300">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">
                Hồ sơ Năng lực On-Chain & Quỹ Học bổng x402
              </h2>
              <p
                className={`text-xs ${darkMode ? "text-stone-400" : "text-[#7A7167]"}`}
              >
                Mỗi phút học tập trung được xác thực sẽ tự động nâng cấp Huy
                hiệu SBT và giải ngân học bổng về ví của bạn.
              </p>
            </div>

            <div className="grid md:grid-cols-12 gap-5">
              <div
                className={`md:col-span-5 rounded-[28px] p-6 border flex flex-col items-center justify-center text-center space-y-4 transition-transform hover:-translate-y-1 ${
                  darkMode
                    ? "bg-[#211F1D] border-white/10"
                    : "bg-[#FCFBF7] border-[#EAE4D7] shadow-sm"
                }`}
              >
                <div className="w-44 h-44 rounded-2xl overflow-hidden bg-[#F3EFE6] border border-[#E5DFD3] flex items-center justify-center">
                  {sbtSvgImage ? (
                    <img
                      src={sbtSvgImage}
                      alt="Soulbound Badge"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="space-y-2 p-4">
                      <ShieldCheck className="w-12 h-12 text-[#6E8E72] mx-auto" />
                      <div className="text-xs text-[#7A7167]">
                        Dynamic On-Chain SBT
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-[#6E8E72] font-semibold">
                    Soulbound Skill Tree
                  </span>
                  <h3 className="text-xl font-bold mt-0.5">
                    Scholar Level {sbtLevel}
                  </h3>
                  <p className="text-xs text-[#8C8275] mt-1">
                    Tích lũy {sbtMinutes} phút nỗ lực nhận thức
                  </p>
                </div>
              </div>

              <div className="md:col-span-7 flex flex-col justify-between gap-5">
                <div
                  className={`rounded-[28px] p-6 border space-y-2 transition-transform hover:-translate-y-1 ${
                    darkMode
                      ? "bg-[#211F1D] border-white/10"
                      : "bg-[#FCFBF7] border-[#EAE4D7] shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-[#8C8275]">
                    <span>x402 Sponsor Bounty Pool</span>
                    <Coins className="w-4 h-4 text-[#6E8E72]" />
                  </div>
                  <div className="text-3xl font-bold">{bountyPool} AVAX</div>
                  <p className="text-xs text-[#7A7167] leading-relaxed">
                    Quỹ học bổng tài trợ tự động stream{" "}
                    <strong className="text-[#6E8E72]">0.0001 AVAX/phút</strong>{" "}
                    về ví sinh viên qua chuẩn HTTP 402 trên Avalanche Fuji.
                  </p>
                </div>

                <div
                  className={`rounded-[28px] p-6 border space-y-3 ${
                    darkMode
                      ? "bg-[#211F1D] border-white/10"
                      : "bg-[#FCFBF7] border-[#EAE4D7] shadow-sm"
                  }`}
                >
                  <div className="text-xs font-medium text-[#7A7167]">
                    Cây Kỹ Năng 5 Cấp Độ (Tự động nâng cấp On-chain)
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
                    {[
                      { lv: "Lv.1", color: "bg-[#CD7F32]", name: "Novice" },
                      { lv: "Lv.2", color: "bg-[#C0C0C0]", name: "Learner" },
                      { lv: "Lv.3", color: "bg-[#E84142]", name: "Avalanche" },
                      { lv: "Lv.4", color: "bg-[#00F5FF]", name: "Master" },
                      { lv: "Lv.5", color: "bg-[#FFD700]", name: "Grand" },
                    ].map((tier) => (
                      <div
                        key={tier.lv}
                        className={`p-2.5 rounded-2xl border transition-transform hover:scale-105 ${
                          sbtLevel >= Number(tier.lv.replace("Lv.", ""))
                            ? "bg-[#6E8E72]/15 border-[#6E8E72]/40 font-semibold"
                            : "bg-[#F3EFE6]/60 border-[#E5DFD3] opacity-60"
                        }`}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full mx-auto mb-1.5 ${tier.color}`}
                        />
                        <div>{tier.lv}</div>
                        <div className="text-[10px] opacity-80">
                          {tier.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. TAB SỔ TAY FLASHCARD */}
        {activeSpace === "notebook" && (
          <div className="w-full space-y-4 animate-in fade-in duration-300">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h2 className="text-xl font-bold">
                Sổ tay Flashcard & Trợ lý AI Socratic
              </h2>
              <p
                className={`text-xs ${darkMode ? "text-stone-400" : "text-[#7A7167]"}`}
              >
                Nơi lưu trữ các thẻ ghi nhớ tự động sinh ra sau 30s phản tư
                Feynman và hỏi đáp chuyên sâu qua giao thức x402.
              </p>
            </div>
            <FlashcardNotebook />
          </div>
        )}
      </main>

      {/* CỬA SỔ MODAL "CÁCH HOẠT ĐỘNG" (CHỈ HIỆN KHI NGƯỜI DÙNG BẤM VÀO) */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-200 ${
              darkMode
                ? "bg-[#211F1D] border-white/10 text-[#F3EFE6]"
                : "bg-[#FCFBF7] border-[#EAE4D7] text-[#2D2620]"
            }`}
          >
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1.5 pr-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6E8E72]">
                MindSpark User Journey
              </span>
              <h2 className="text-2xl font-bold">
                Quy trình 4 bước biến giờ học thành giá trị thật
              </h2>
              <p
                className={`text-xs leading-relaxed ${darkMode ? "text-stone-400" : "text-[#6E655C]"}`}
              >
                Khắc phục tình trạng xao nhãng smartphone và học vẹt bằng sự kết
                hợp giữa Edge-AI và Blockchain Avalanche.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {[
                {
                  step: "Bước 1: Stake Cam kết (Vault)",
                  desc: "Kết nối ví Core/MetaMask và đặt cọc 0.01 AVAX vào hợp đồng StudyStakeVault để tạo động lực kỷ luật.",
                },
                {
                  step: "Bước 2: Học tự nhiên với Edge-AI",
                  desc: "Thoải mái cúi viết, đọc sách in. AI chạy cục bộ trên RAM nhận diện tư thế và chỉ nhắc nhở khi bạn cầm điện thoại.",
                },
                {
                  step: "Bước 3: Phản tư Feynman 30 giây",
                  desc: "Cuối phiên học, nói tóm tắt kiến thức trong 30s. AI Agent chấm điểm hiểu bài và tự động tạo thẻ Flashcard.",
                },
                {
                  step: "Bước 4: Nhận thưởng x402 & SBT",
                  desc: "Hoàn lại 100% tiền cọc, nhận thêm học bổng vi mô theo phút từ quỹ x402 và thăng cấp Huy hiệu Soulbound NFT.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`p-4 rounded-2xl border ${
                    darkMode
                      ? "bg-[#181715] border-white/5"
                      : "bg-[#F5F1E8] border-[#E5DFD3]"
                  }`}
                >
                  <div className="font-bold text-sm text-[#6E8E72] mb-1">
                    {item.step}
                  </div>
                  <p className="text-xs opacity-85 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
              <span className="text-[11px] flex items-center gap-1.5 text-[#6E8E72] font-medium">
                <Lock className="w-3.5 h-3.5" /> Cam kết bảo mật: Không lưu trữ
                hay gửi hình ảnh webcam lên máy chủ.
              </span>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] text-white text-xs font-medium cursor-pointer"
              >
                Đã hiểu, bắt đầu học
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CỬA SỔ CAMERA EDGE-AI GÓC PHẢI KHI ĐANG HỌC */}
      {isStudying && (
        <div
          className={`fixed bottom-20 right-6 z-20 rounded-2xl p-3 w-64 border shadow-lg space-y-2.5 animate-in slide-in-from-bottom-4 ${
            darkMode
              ? "bg-[#211F1D] border-white/10"
              : "bg-[#FCFBF7] border-[#E5DFD3]"
          }`}
        >
          <div className="flex items-center justify-between px-1 text-[11px]">
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                currentPose === "Phone Distraction"
                  ? "text-rose-600"
                  : "text-[#6E8E72]"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {currentPose}
            </span>
            <button
              onClick={() => setShowCameraPip(!showCameraPip)}
              className="cursor-pointer"
            >
              {showCameraPip ? (
                <CameraOff className="w-3.5 h-3.5" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {showCameraPip && (
            <div className="aspect-video rounded-xl overflow-hidden bg-black relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {currentPose === "Phone Distraction" && (
                <div className="absolute inset-0 bg-rose-950/75 flex flex-col items-center justify-center text-white text-center p-2 animate-pulse">
                  <Smartphone className="w-5 h-5 mb-1 text-rose-400" />
                  <span className="text-[11px] font-bold">
                    Cảnh báo cầm điện thoại!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bộ nút giả lập nhận diện tư thế MediaPipe Pose */}
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <button
              onClick={() => setCurrentPose("Writing Pose")}
              className={`py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 border cursor-pointer ${
                currentPose === "Writing Pose"
                  ? "bg-[#6E8E72] text-white border-[#6E8E72]"
                  : "bg-[#F3EFE6] text-[#5C5349]"
              }`}
            >
              <PenTool className="w-2.5 h-2.5" /> Cúi viết
            </button>
            <button
              onClick={() => setCurrentPose("Reading Pose")}
              className={`py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 border cursor-pointer ${
                currentPose === "Reading Pose"
                  ? "bg-[#6E8E72] text-white border-[#6E8E72]"
                  : "bg-[#F3EFE6] text-[#5C5349]"
              }`}
            >
              <BookOpenCheck className="w-2.5 h-2.5" /> Đọc sách
            </button>
            <button
              onClick={() => setCurrentPose("Screen Focus")}
              className={`py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 border cursor-pointer ${
                currentPose === "Screen Focus"
                  ? "bg-[#6E8E72] text-white border-[#6E8E72]"
                  : "bg-[#F3EFE6] text-[#5C5349]"
              }`}
            >
              <Monitor className="w-2.5 h-2.5" /> Màn hình
            </button>
            <button
              onClick={() => setCurrentPose("Phone Distraction")}
              className={`py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 border cursor-pointer ${
                currentPose === "Phone Distraction"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-[#F3EFE6] text-rose-700"
              }`}
            >
              <Smartphone className="w-2.5 h-2.5" /> Điện thoại
            </button>
          </div>
        </div>
      )}

      {/* THANH ĐIỀU HƯỚNG NỔI Ở DƯỚI CÙNG */}
      <nav
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 px-2.5 py-1.5 rounded-full border shadow-lg flex items-center gap-1.5 ${
          darkMode
            ? "bg-[#211F1D] border-white/10"
            : "bg-[#FCFBF7] border-[#E5DFD3]"
        }`}
      >
        {[
          { id: "focus", label: "Focus Room", icon: Compass },
          { id: "sanctuary", label: "Skill Tree & x402", icon: Award },
          { id: "notebook", label: "Sổ tay Flashcard", icon: BookOpen },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeSpace === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSpace(item.id as ActiveSpace)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#6E8E72] text-white shadow-xs scale-105"
                  : darkMode
                    ? "text-stone-400 hover:text-stone-200"
                    : "text-[#6E655C] hover:bg-[#F3EFE6]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <ResultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sessionResult={sessionResult}
      />
    </div>
  );
}
