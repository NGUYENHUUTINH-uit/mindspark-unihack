"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useSwitchChain,
  usePublicClient,
} from "wagmi";
import { parseEther } from "viem";
import { avalancheFuji } from "wagmi/chains";
import { CONTRACTS } from "@/config/wagmi";
import { VAULT_ABI, SBT_ABI } from "@/config/abis";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import {
  FlashcardNotebook,
  DEFAULT_FLASHCARDS,
  type NotebookFlashcard,
} from "@/components/FlashcardNotebook";
import {
  ResultModal,
  type SessionResultData,
} from "@/components/ResultModal";
import {
  QuizModal,
  type QuizCompletionPayload,
  type QuizFlashcard,
} from "@/components/QuizModal";
import { usePoseTracker, type StudyPose } from "@/hooks/usePoseTracker";
import {
  Minus,
  Plus,
  Moon,
  Sun,
  Volume2,
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
  Users,
  UserCheck,
  Flame,
  Cpu,
  Activity,
  AlertTriangle,
  Gift,
  CheckCircle2,
  Loader2,
  PauseCircle,
  Play,
  Maximize2,
  Minimize2,
  Coffee,
  RotateCcw,
  Send,
  Check,
} from "lucide-react";

type ActiveSpace = "focus" | "sanctuary" | "notebook";
type SoundTrackId = "off" | "rain" | "lofi" | "ocean" | "fire";

const SOUND_TRACKS: { id: SoundTrackId; label: string; emoji: string }[] = [
  { id: "off", label: "Tắt nhạc", emoji: "🔇" },
  { id: "rain", label: "Mưa tĩnh tâm", emoji: "🌧️" },
  { id: "lofi", label: "Lo-fi Synth", emoji: "🎹" },
  { id: "ocean", label: "Sóng biển", emoji: "🌊" },
  { id: "fire", label: "Lửa trại ấm", emoji: "🔥" },
];

const TOPIC_PRESETS = [
  "Cấu trúc dữ liệu & Giải thuật",
  "Machine Learning cơ bản",
  "Kinh tế vi mô",
  "Avalanche Consensus & Subnets",
];

const REWARD_MARKETPLACE = [
  {
    id: "rw-1",
    title: "Voucher Khóa học Avalanche Builders",
    sponsor: "Avalanche Academy",
    requiredLevel: 1,
    pointsCost: "Lv.1 • 30p+",
    code: "AVAX-BUILD-2026",
  },
  {
    id: "rw-2",
    title: "Gói 20 lượt AI Socratic Copilot",
    sponsor: "MindSpark Guild",
    requiredLevel: 2,
    pointsCost: "Lv.2 • 300p+",
    code: "MINDSPARK-PRO-X402",
  },
  {
    id: "rw-3",
    title: "Học bổng Hackathon Cloud Credits (\$50)",
    sponsor: "Sponsor Bounty Pool",
    requiredLevel: 3,
    pointsCost: "Lv.3 • 900p+",
    code: "UNIHACK-SCHOLAR-50",
  },
];

const FLASHCARDS_STORAGE_KEY = "mindspark_flashcards_v1";
const REDEEMED_STORAGE_KEY = "mindspark_redeemed_rewards_v1";

export default function MindSparkInteractiveStudio() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  // Giao diện & Modal Hướng dẫn (Mặc định FALSE -> chỉ hiện khi người dùng bấm)
  const [darkMode, setDarkMode] = useState(false);
  const [activeSpace, setActiveSpace] = useState<ActiveSpace>("focus");
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Chế độ học Cá nhân / Nhóm & Chủ đề học tập (để trống cho người dùng tự nhập)
  const [studyMode, setStudyMode] = useState<"solo" | "group">("solo");
  const [studyTopic, setStudyTopic] = useState("");

  // Trạng thái Pomodoro & Bảng chọn phương thức đánh giá sau phiên học
  const [studyMinutes, setStudyMinutes] = useState(45);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [isStudying, setIsStudying] = useState(false);
  const [isStakingTx, setIsStakingTx] = useState(false);
  const [showAssessmentChoice, setShowAssessmentChoice] = useState(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState<number | null>(null);

  // Edge-AI Studio Camera Monitor
  const [showCameraPip, setShowCameraPip] = useState(true);
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Feynman 30s Voice Reflection (2-bước: Transcribe -> Review & Grade) + Audio Visualizer
  const [isRecordingFeynman, setIsRecordingFeynman] = useState(false);
  const [feynmanStep, setFeynmanStep] = useState<
    "idle" | "recording" | "transcribing" | "review" | "grading"
  >("idle");
  const [feynmanSeconds, setFeynmanSeconds] = useState(30);
  const feynmanSecondsRef = useRef(30);
  feynmanSecondsRef.current = feynmanSeconds;
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const recordedAudioUrlRef = useRef<string | null>(null);
  const [editableTranscript, setEditableTranscript] = useState("");
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "quiet" | "error">("idle");
  const [feynmanNotice, setFeynmanNotice] = useState("");
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(20).fill(15));

  // Quiz Mode B Modal
  const [quizModalOpen, setQuizModalOpen] = useState(false);

  // Dữ liệu On-chain, Flashcards & ResultModal
  const [bountyPool, setBountyPool] = useState("0.0000");
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResultData | null>(null);
  const [flashcards, setFlashcards] = useState<NotebookFlashcard[]>(DEFAULT_FLASHCARDS);
  const [redeemedRewards, setRedeemedRewards] = useState<string[]>([]);

  // Trình phát nhạc nhiều bản nhạc (Web Audio Synthesizer)
  const [currentTrack, setCurrentTrack] = useState<SoundTrackId>("off");
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalMusicRef = useRef<NodeJS.Timeout | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Âm thanh chuông thông báo bằng Web Audio API (MU-21, MU-25)
  const playTone = useCallback((freq: number, durationMs: number, type: OscillatorType = "sine") => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
      setTimeout(() => ctx.close().catch(() => {}), durationMs + 150);
    } catch {
      // Bỏ qua nếu trình duyệt chặn autoplay audio
    }
  }, []);

  const handleAlertBeep = useCallback(
    (reason: "phone" | "absent") => {
      if (reason === "phone") {
        playTone(880, 180, "triangle");
        setTimeout(() => playTone(660, 220, "triangle"), 200);
      } else {
        playTone(520, 280, "sine");
      }
    },
    [playTone],
  );

  const playPomodoroEndChime = useCallback(() => {
    playTone(523.25, 200, "sine"); // C5
    setTimeout(() => playTone(659.25, 220, "sine"), 180); // E5
    setTimeout(() => playTone(783.99, 360, "sine"), 360); // G5
  }, [playTone]);

  // Hook Edge-AI Computer Vision (MU-12, MU-13, MU-15, MU-17)
  const {
    currentPose,
    focusIndex,
    setFocusIndex,
    isAutoDetect,
    setIsAutoDetect,
    cameraStatus,
    headTiltAngle,
    postureConfidence,
    isLiveSubject,
    livenessScore,
    blinkCount,
    visionEngine,
    hasPhoneDetector,
    distractionSeconds,
    absenceSeconds,
    isDistractionAlert,
    isPausedByAi,
    selectManualPose,
    resetTracker,
  } = usePoseTracker({
    videoRef,
    isStudying,
    showCameraPip,
    distractionThresholdSec: 5,
    absenceThresholdSec: 5,
    onAlertBeep: handleAlertBeep,
  });

  // Load & Persist Flashcards + Redeemed Rewards từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FLASHCARDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setFlashcards(parsed);
      }
      const savedRewards = localStorage.getItem(REDEEMED_STORAGE_KEY);
      if (savedRewards) {
        const parsedRewards = JSON.parse(savedRewards);
        if (Array.isArray(parsedRewards)) setRedeemedRewards(parsedRewards);
      }
    } catch {
      // Dùng mặc định nếu localStorage không khả dụng
    }
  }, []);

  const appendFlashcards = useCallback((newCards: QuizFlashcard[] | Omit<NotebookFlashcard, "id">[]) => {
    if (!newCards || newCards.length === 0) return;
    setFlashcards((prev) => {
      const now = Date.now();
      const mapped: NotebookFlashcard[] = newCards.map((c, idx) => ({
        id: now + idx,
        tag: c.tag || "AI Generated",
        front: c.front,
        back: c.back,
      }));
      // Tránh trùng lặp y hệt mặt trước
      const existingFronts = new Set(prev.map((p) => p.front.trim()));
      const filtered = mapped.filter((m) => !existingFronts.has(m.front.trim()));
      const updated = [...filtered, ...prev];
      try {
        localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Bỏ qua nếu đầy bộ nhớ trình duyệt
      }
      return updated;
    });
  }, []);

  // Danh sách bạn bè học chung trong phòng (Study Guild)
  const groupPeers = [
    {
      id: "peer-1",
      name: "Alex Nguyễn",
      school: "UIT - ĐHQG TP.HCM",
      address: "0x71C2...8821",
      topic: "Avalanche Consensus",
      minsLeft: 18,
      status: "Tập trung 🟢",
      avatarBg: "from-blue-600 to-indigo-800",
    },
    {
      id: "peer-2",
      name: "Minh Trần",
      school: "Bách Khoa TP.HCM",
      address: "0x39B1...2094",
      topic: "EIP-191 & Oracle",
      minsLeft: 34,
      status: "Tập trung 🟢",
      avatarBg: "from-purple-600 to-pink-800",
    },
    {
      id: "peer-3",
      name: "Elena Vũ",
      school: "KHTN TP.HCM",
      address: "0x58F0...4419",
      topic: "Zero-Knowledge Proofs",
      minsLeft: 7,
      status: "Tập trung 🟢",
      avatarBg: "from-emerald-600 to-teal-800",
    },
  ];

  // Đọc phiên Stake đang active của ví từ StudyStakeVault (tránh lỗi F5 rồi stake đè)
  const { data: activeVaultSession, refetch: refetchVaultSession } = useReadContract({
    address: CONTRACTS.VAULT,
    abi: VAULT_ABI,
    functionName: "userSessions",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(address) },
  });

  const hasActiveOnChainSession = Boolean(activeVaultSession && activeVaultSession[4]);
  const onChainTargetMinutes = activeVaultSession ? Number(activeVaultSession[1]) : 30;

  // Đọc Token ID SBT của sinh viên theo địa chỉ ví (nếu chưa mint -> fallback Token #1)
  const { data: studentBadgeId, refetch: refetchStudentBadgeId } = useReadContract({
    address: CONTRACTS.SBT,
    abi: SBT_ABI,
    functionName: "studentToBadgeId",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(address) },
  });

  const userHasPersonalBadge = Boolean(studentBadgeId && studentBadgeId > BigInt(0));
  const queryBadgeId = userHasPersonalBadge ? studentBadgeId! : BigInt(1);

  const { data: badgeMetrics, refetch: refetchBadgeMetrics } = useReadContract({
    address: CONTRACTS.SBT,
    abi: SBT_ABI,
    functionName: "badgeMetrics",
    args: [queryBadgeId],
  });

  const { data: tokenUri, refetch: refetchTokenUri } = useReadContract({
    address: CONTRACTS.SBT,
    abi: SBT_ABI,
    functionName: "tokenURI",
    args: [queryBadgeId],
  });

  const refreshOnChainState = useCallback(() => {
    refetchVaultSession();
    refetchStudentBadgeId();
    refetchBadgeMetrics();
    refetchTokenUri();
  }, [refetchVaultSession, refetchStudentBadgeId, refetchBadgeMetrics, refetchTokenUri]);

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

  // Lấy số dư quỹ x402 Bounty Pool từ API Gateway
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
      const chords = [
        [174.61, 220.0, 261.63, 329.63],
        [164.81, 196.0, 246.94, 293.66],
        [146.83, 174.61, 220.0, 261.63],
        [130.81, 164.81, 196.0, 246.94],
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

  // Dừng MediaRecorder an toàn và đợi trả về Blob đầy đủ (tránh audio rỗng khi nộp sớm!)
  const stopRecorderAndGetBlob = useCallback(async (): Promise<Blob> => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const prevOnStop = recorder.onstop;
        recorder.onstop = (ev) => {
          if (prevOnStop) prevOnStop.call(recorder, ev);
          resolve();
        };
        try {
          recorder.requestData();
        } catch {
          // Một số trình duyệt không cần requestData
        }
        recorder.stop();
        setTimeout(resolve, 450); // Timeout bảo vệ tối đa 450ms
      });
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    const mimeType = recorder?.mimeType || "audio/webm";
    return new Blob(audioChunksRef.current, { type: mimeType });
  }, []);

  const replaceRecordedAudioUrl = useCallback((blob: Blob | null) => {
    if (recordedAudioUrlRef.current) {
      URL.revokeObjectURL(recordedAudioUrlRef.current);
      recordedAudioUrlRef.current = null;
    }
    if (blob && blob.size > 0) {
      const nextUrl = URL.createObjectURL(blob);
      recordedAudioUrlRef.current = nextUrl;
      setRecordedAudioUrl(nextUrl);
    } else {
      setRecordedAudioUrl(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
      }
    };
  }, []);

  // Đồng hồ đếm ngược Pomodoro (Tự động tạm dừng khi isPausedByAi === true!)
  useEffect(() => {
    if (!isStudying) return;
    const timer = setInterval(() => {
      if (!isPausedByAi) {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            playPomodoroEndChime();
            setIsStudying(false);
            setShowAssessmentChoice(true);
            return 0;
          }
          return prev - 1;
        });
      }

      setFocusIndex((prev) => {
        if (currentPose === "Phone Distraction" || currentPose === "Drowsy / Absent") {
          return Math.max(40, prev - 2);
        }
        if (currentPose === "Thinking / Rest") return prev;
        if (!isLiveSubject) return Math.max(50, prev - 1);
        return Math.min(100, prev + 1);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isStudying, isPausedByAi, currentPose, isLiveSubject, setFocusIndex, playPomodoroEndChime]);

  // Đếm ngược nghỉ giải lao ngắn (nếu người dùng chọn nghỉ trước khi làm bài đánh giá)
  useEffect(() => {
    if (breakSecondsLeft === null || breakSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          playPomodoroEndChime();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [breakSecondsLeft, playPomodoroEndChime]);

  // Helper gọi Demo Fast-Track từ Gateway (chỉ khi bật ENABLE_DEMO_ATTEST=true)
  const requestDemoAttestFromGateway = useCallback(async () => {
    const gatewayUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";
    const minutesToAttest = hasActiveOnChainSession
      ? Math.max(30, onChainTargetMinutes)
      : Math.max(30, studyMinutes);

    const res = await fetch(`${gatewayUrl}/api/v1/oracle/demo-attest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentAddress: address || "0xA206B966480E6eeE2F3F96e6958899e71501B8e2",
        completedMinutes: minutesToAttest,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.signature) {
      alert(data.error || "Chế độ Demo Attest đang tắt trên Gateway.");
      return;
    }

    setSessionResult({
      passed: true,
      actualMinutes: studyMinutes,
      completedMinutes: minutesToAttest,
      feynmanScore: data.feynmanScore || 75,
      signature: data.signature,
      aiFeedback: `Chế độ Demo Fast-Track (${studyMinutes} phút): Focus Index ${focusIndex}%. Oracle Gateway đã cấp chữ ký EIP-191 để test Claim on-chain.`,
      didUserSpeak: false,
      mode: "demo",
      stakedAmount: "0.0100 AVAX",
      vaultAddress: CONTRACTS.VAULT,
    });
  }, [address, focusIndex, hasActiveOnChainSession, onChainTargetMinutes, studyMinutes]);

  const startFeynmanRecording = useCallback(() => {
    setFeynmanNotice("");
    replaceRecordedAudioUrl(null);
    setEditableTranscript("");
    setShowAssessmentChoice(false);
    setBreakSecondsLeft(null);
    setFeynmanSeconds(30);
    setMicStatus("listening");
    setFeynmanStep("recording");
    setIsRecordingFeynman(true);
  }, [replaceRecordedAudioUrl]);

  const transcribingLockRef = useRef(false);

  // Bước 1 Feynman Voice: Flush audio TRƯỚC khi tắt stream -> gọi /api/feynman/transcribe -> chuyển sang màn hình Review
  const handleStopAndTranscribe = useCallback(async () => {
    if (transcribingLockRef.current) return;
    transcribingLockRef.current = true;
    setFeynmanNotice("");

    try {
      // QUAN TRỌNG: Đợi flush blob xong TRƯỚC khi setIsRecordingFeynman(false) để tránh cleanup giết recorder sớm
      const audioBlob = await stopRecorderAndGetBlob();
      if (audioBlob.size > 0) {
        replaceRecordedAudioUrl(audioBlob);
      }
      setIsRecordingFeynman(false);
      setFeynmanSeconds(30);
      setFeynmanStep("transcribing");

      const didCaptureAudio = audioBlob.size > 1200;
      if (!didCaptureAudio) {
        setEditableTranscript("");
        setFeynmanNotice(
          "Chưa thu được đủ dữ liệu âm thanh từ Micro. Bạn có thể thu âm lại, gõ trực tiếp tóm tắt bên dưới, hoặc chuyển sang làm Quiz 5 câu."
        );
        setFeynmanStep("review");
        return;
      }

      const aiServiceUrl =
        process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";
      const mime = audioBlob.type || "audio/webm";
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";

      const formData = new FormData();
      formData.append("audio", audioBlob, `feynman_reflection.${ext}`);
      if (studyTopic.trim()) {
        formData.append("topic", studyTopic.trim());
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(`${aiServiceUrl}/api/feynman/transcribe`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const text = (data.transcript || "").trim();
          setEditableTranscript(text);
          if (data.likely_silence || !text) {
            setFeynmanNotice(
              "Micro chưa bắt được tiếng rõ (hệ thống nhận diện im lặng). Bạn có thể nghe lại file bên trên, thu âm lại gần micro hơn, gõ tóm tắt trực tiếp, hoặc làm Quiz 5 câu."
            );
          }
        } else {
          const errJson = await res.json().catch(() => ({}));
          setEditableTranscript("");
          setFeynmanNotice(
            errJson.detail ||
              "Dịch vụ nhận dạng giọng nói tạm thời bận. Bạn có thể gõ tóm tắt trực tiếp bên dưới hoặc chuyển sang làm Quiz 5 câu."
          );
        }
      } catch {
        clearTimeout(timeoutId);
        setEditableTranscript("");
        setFeynmanNotice(
          "Không thể kết nối AI Speech-to-Text (cổng 8000). Bạn có thể gõ tóm tắt bên dưới để AI chấm hoặc chuyển sang làm Quiz 5 câu!"
        );
      }

      setFeynmanStep("review");
    } finally {
      transcribingLockRef.current = false;
    }
  }, [stopRecorderAndGetBlob, replaceRecordedAudioUrl, studyTopic]);

  const handleStopAndTranscribeRef = useRef(handleStopAndTranscribe);
  handleStopAndTranscribeRef.current = handleStopAndTranscribe;

  // Bước 2 Feynman Voice: Chấm điểm bản transcript đã xem/sửa qua POST /api/feynman/evaluate-text
  const handleEvaluateTranscript = useCallback(async () => {
    const cleanText = editableTranscript.trim();
    if (!cleanText || feynmanStep === "grading") return;

    setFeynmanStep("grading");
    setFeynmanNotice("");

    const aiServiceUrl =
      process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";
    const gatewayUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";
    const minutesToAttest = hasActiveOnChainSession
      ? Math.max(30, onChainTargetMinutes)
      : Math.max(30, studyMinutes);

    let nextResult: SessionResultData | null = null;
    let aiOffline = false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch(`${aiServiceUrl}/api/feynman/evaluate-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: cleanText,
          wallet_address: address || "0xA206B966480E6eeE2F3F96e6958899e71501B8e2",
          session_id: `sess_${Date.now()}`,
          minutes_studied: minutesToAttest,
          topic: studyTopic.trim() || "Kiến thức tổng hợp phiên học",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const aiData = await res.json();
        const generatedCards: QuizFlashcard[] = (aiData.flashcards || []).map((fc: any) => ({
          tag: "Feynman 30s • AI",
          front: fc.question,
          back: fc.answer,
        }));
        if (generatedCards.length > 0) {
          appendFlashcards(generatedCards);
        }

        if (aiData.passed && aiData.proof?.signature) {
          nextResult = {
            passed: true,
            actualMinutes: studyMinutes,
            completedMinutes: aiData.proof.completedMinutes || minutesToAttest,
            feynmanScore: aiData.proof.feynmanScore || 85,
            llmScore: aiData.score,
            signature: aiData.proof.signature,
            aiFeedback: aiData.feedback,
            transcript: aiData.transcript,
            flashcards: generatedCards,
            didUserSpeak: true,
            mode: "voice",
            oracleMock: Boolean(aiData.proof.mock),
            stakedAmount: "0.0100 AVAX",
            vaultAddress: CONTRACTS.VAULT,
          };
        } else {
          nextResult = {
            passed: false,
            actualMinutes: studyMinutes,
            completedMinutes: minutesToAttest,
            feynmanScore: 0,
            llmScore: aiData.score ?? 1,
            aiFeedback:
              aiData.feedback ||
              "Nội dung chưa đạt 15 từ hoặc chưa giải thích rõ trọng tâm chủ đề.",
            transcript: aiData.transcript,
            flashcards: generatedCards,
            didUserSpeak: true,
            mode: "voice",
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        aiOffline = res.status >= 500;
        nextResult = {
          passed: false,
          actualMinutes: studyMinutes,
          completedMinutes: minutesToAttest,
          feynmanScore: 0,
          aiFeedback: errJson.detail || `AI Service trả lỗi HTTP ${res.status}.`,
          transcript: cleanText,
          didUserSpeak: true,
          mode: "voice",
        };
      }
    } catch {
      clearTimeout(timeoutId);
      aiOffline = true;
    }

    if (!nextResult && aiOffline) {
      try {
        const demoRes = await fetch(`${gatewayUrl}/api/v1/oracle/demo-attest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentAddress: address || "0xA206B966480E6eeE2F3F96e6958899e71501B8e2",
            completedMinutes: minutesToAttest,
          }),
        });
        if (demoRes.ok) {
          const demoData = await demoRes.json();
          nextResult = {
            passed: true,
            actualMinutes: studyMinutes,
            completedMinutes: minutesToAttest,
            feynmanScore: demoData.feynmanScore || 75,
            signature: demoData.signature,
            aiFeedback: `AI Service tạm gián đoạn (${studyMinutes} phút). Gateway Demo Attest đã ký xác thực dự phòng để tiếp tục demo.`,
            transcript: cleanText,
            didUserSpeak: true,
            mode: "demo",
            stakedAmount: "0.0100 AVAX",
            vaultAddress: CONTRACTS.VAULT,
          };
        }
      } catch {
        // Gateway cũng không bật demo-attest
      }
    }

    if (!nextResult) {
      nextResult = {
        passed: false,
        actualMinutes: studyMinutes,
        completedMinutes: minutesToAttest,
        feynmanScore: 0,
        transcript: cleanText,
        aiFeedback:
          "AI Service (cổng 8000) phản hồi chậm hoặc đang ngoại tuyến. Bạn có thể thử gửi chấm lại hoặc chuyển sang làm Quiz 5 câu!",
        didUserSpeak: true,
        mode: "voice",
      };
    }

    setFeynmanStep("idle");
    setSessionResult(nextResult);
    setModalOpen(true);
  }, [
    editableTranscript,
    feynmanStep,
    hasActiveOnChainSession,
    onChainTargetMinutes,
    studyMinutes,
    address,
    studyTopic,
    appendFlashcards,
  ]);

  // Thu âm Micro & Sóng âm Visualizer cho Feynman 30s (chỉ báo RMS thật, chọn MIME tương thích nhất)
  useEffect(() => {
    if (!isRecordingFeynman) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    let animFrame = 0;
    let audioCtx: AudioContext | undefined;
    let cancelled = false;
    audioChunksRef.current = [];
    const startedAt = performance.now();
    let peakSignal = 0;

    navigator.mediaDevices
      ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        const mimeCandidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg",
        ];
        const chosenMime =
          typeof MediaRecorder !== "undefined" &&
          typeof MediaRecorder.isTypeSupported === "function"
            ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m))
            : undefined;

        try {
          const recorder = chosenMime
            ? new MediaRecorder(stream, { mimeType: chosenMime })
            : new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          recorder.start(250);
        } catch (e) {
          console.warn("MediaRecorder không hỗ trợ định dạng này:", e);
          setMicStatus("error");
        }

        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVisualizer = () => {
          analyser.getByteFrequencyData(dataArray);
          const slice = Array.from(dataArray.slice(0, 20));
          const rms =
            slice.reduce((acc, v) => acc + v * v, 0) / Math.max(1, slice.length);
          const normPeak = Math.sqrt(rms);
          if (normPeak > peakSignal) peakSignal = normPeak;

          if (normPeak > 12) {
            setMicStatus("listening");
          } else if (performance.now() - startedAt > 2800 && peakSignal < 10) {
            setMicStatus("quiet");
          }

          const bars = slice.map((val) =>
            Math.max(12, Math.min(100, (val / 220) * 100))
          );
          setAudioLevels(bars);
          animFrame = requestAnimationFrame(updateVisualizer);
        };
        updateVisualizer();
      })
      .catch(() => {
        if (!cancelled) {
          setMicStatus("error");
          setAudioLevels(Array(20).fill(10));
          setFeynmanNotice(
            "Không truy cập được Micro trình duyệt. Hãy kiểm tra quyền Micro hoặc chuyển sang gõ văn bản / làm Quiz 5 câu!"
          );
        }
      });

    const timer = setInterval(() => {
      setFeynmanSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleStopAndTranscribeRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [isRecordingFeynman]);

  const handleAdjustStudyTime = (delta: number) => {
    if (isStudying) return;
    const next = Math.max(1, Math.min(120, studyMinutes + delta));
    setStudyMinutes(next);
    setSecondsLeft(next * 60);
  };

  // Tiếp tục phiên cọc đã tồn tại trên Blockchain
  const handleResumeExistingSession = () => {
    setShowAssessmentChoice(false);
    setBreakSecondsLeft(null);
    setFeynmanStep("idle");
    setIsRecordingFeynman(false);
    setSecondsLeft(studyMinutes * 60);
    resetTracker();
    setIsStudying(true);
  };

  // Bắt đầu phiên học: Cọc 0.01 AVAX vào StudyStakeVault trên Avalanche Fuji
  const handleStartSession = async () => {
    if (!isConnected) {
      return alert(
        "Vui lòng kết nối ví Avalanche ở góc trên bên phải để đặt cọc phiên học.",
      );
    }

    if (hasActiveOnChainSession) {
      handleResumeExistingSession();
      return;
    }

    if (chainId !== avalancheFuji.id) {
      try {
        await switchChainAsync({ chainId: avalancheFuji.id });
      } catch {
        return alert(
          "Vui lòng chuyển ví sang mạng Avalanche Fuji Testnet để tham gia cọc AVAX!",
        );
      }
    }

    setIsStakingTx(true);
    try {
      const minutesForContract = BigInt(Math.max(30, studyMinutes));
      const txHash = await writeContractAsync({
        address: CONTRACTS.VAULT,
        abi: VAULT_ABI,
        functionName: "stake",
        args: [minutesForContract, BigInt(1)],
        value: parseEther("0.01"),
        account: address,
        chainId: avalancheFuji.id,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      refetchVaultSession();
      setSecondsLeft(studyMinutes * 60);
      resetTracker();
      setIsStudying(true);
    } catch (err: any) {
      if (
        err?.name === "UserRejectedRequestError" ||
        err?.message?.includes("User rejected") ||
        err?.message?.includes("User denied")
      ) {
        console.log("Người dùng đã hủy xác nhận giao dịch trên ví.");
        return;
      }
      console.error("Lỗi Stake:", err);
      alert(
        `Lỗi cọc AVAX: ${err.shortMessage || err.message || "Giao dịch bị từ chối"}`,
      );
    } finally {
      setIsStakingTx(false);
    }
  };

  const handleResetOrChange = useCallback(() => {
    setIsStudying(false);
    setShowAssessmentChoice(false);
    setBreakSecondsLeft(null);
    setIsRecordingFeynman(false);
    setFeynmanStep("idle");
    setFeynmanSeconds(30);
    setEditableTranscript("");
    setFeynmanNotice("");
    replaceRecordedAudioUrl(null);
    setSecondsLeft(studyMinutes * 60);
    resetTracker();
  }, [replaceRecordedAudioUrl, resetTracker, studyMinutes]);

  const handleQuizComplete = (payload: QuizCompletionPayload) => {
    setQuizModalOpen(false);
    setSessionResult({
      passed: payload.passed,
      actualMinutes: payload.actualMinutes,
      completedMinutes: payload.completedMinutes,
      feynmanScore: payload.feynmanScore,
      llmScore: payload.llmScore,
      signature: payload.signature,
      aiFeedback: payload.aiFeedback,
      flashcards: payload.flashcards,
      mode: "quiz",
      oracleMock: payload.oracleMock,
      stakedAmount: "0.0100 AVAX",
      vaultAddress: CONTRACTS.VAULT,
    });
    setModalOpen(true);
  };

  const handleRedeemReward = (rewardId: string, code: string) => {
    if (redeemedRewards.includes(rewardId)) return;
    const updated = [...redeemedRewards, rewardId];
    setRedeemedRewards(updated);
    try {
      localStorage.setItem(REDEEMED_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Bỏ qua
    }
    alert(`🎉 Đổi quà thành công! Mã Voucher của bạn: ${code}`);
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

  const sbtLevel = badgeMetrics ? Number(badgeMetrics[0]) || 1 : 1;
  const sbtMinutes = badgeMetrics ? Number(badgeMetrics[1]) : 0;
  const sbtSessions = badgeMetrics ? Number(badgeMetrics[2]) : 0;
  const sbtAvgScore = badgeMetrics ? Number(badgeMetrics[3]) : 0;
  const activeSoundObj =
    SOUND_TRACKS.find((t) => t.id === currentTrack) || SOUND_TRACKS[0];

  const activeMinutesForModes = hasActiveOnChainSession
    ? Math.max(30, onChainTargetMinutes)
    : Math.max(30, studyMinutes);

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
        {/* 1. KHÔNG GIAN FOCUS ROOM */}
        {activeSpace === "focus" && (() => {
          const transcriptWordCount = editableTranscript
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;
          const isFocusIdle =
            !isStudying && !showAssessmentChoice && feynmanStep === "idle";
          const activeTopicLabel =
            studyTopic.trim() || "Kiến thức tổng hợp phiên học";

          const poseBadgeStyle =
            currentPose === "Phone Distraction" ||
            currentPose === "Drowsy / Absent"
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 animate-pulse font-bold"
              : currentPose === "Thinking / Rest"
                ? "bg-sky-500/15 text-sky-600 dark:text-sky-300 font-semibold"
                : "bg-[#6E8E72]/15 text-[#6E8E72] font-semibold";

          const poseDisplayLabel =
            currentPose === "Thinking / Rest"
              ? "🧠 Tư thế suy nghĩ / Nghỉ ngơi"
              : currentPose === "Drowsy / Absent"
                ? "⚠️ Vắng mặt / Rời khung hình"
                : currentPose === "Phone Distraction"
                  ? "📱 Phát hiện điện thoại"
                  : currentPose;

          return (
            <div
              className={`w-full ${isStudying ? "max-w-6xl" : "max-w-4xl"} flex flex-col items-center space-y-6 animate-in fade-in duration-500`}
            >
              {isFocusIdle && (
                <>
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
                      bảo vệ của AI chống xao nhãng điện thoại, tự chọn thuyết trình
                      Feynman 30 giây hoặc Quiz 5 câu để nhận thưởng qua giao thức{" "}
                      <strong>x402</strong>.
                    </p>
                  </div>

                  {/* Thanh chọn Chế độ Cá nhân / Học nhóm */}
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-medium ${darkMode ? "text-stone-400" : "text-[#7A7167]"}`}
                    >
                      Chế độ:
                    </span>
                    <div
                      className={`p-1 rounded-full border flex gap-1 ${
                        darkMode
                          ? "bg-[#211F1D] border-white/10"
                          : "bg-[#FCFBF7] border-[#E5DFD3]"
                      }`}
                    >
                      <button
                        onClick={() => setStudyMode("solo")}
                        className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                          studyMode === "solo"
                            ? "bg-[#6E8E72] text-white shadow-xs"
                            : "text-stone-400 hover:text-stone-200"
                        }`}
                      >
                        👤 Solo
                      </button>
                      <button
                        onClick={() => setStudyMode("group")}
                        className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                          studyMode === "group"
                            ? "bg-[#6E8E72] text-white shadow-xs"
                            : "text-stone-400 hover:text-stone-200"
                        }`}
                      >
                        👥 Study Guild (4 Online)
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* A. GIAO DIỆN ĐANG HỌC: STUDIO CAMERA 2 CỘT + POMODORO */}
              {isStudying && (
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* CỘT CAMERA STUDIO LỚN */}
                  <div
                    className={`${cameraExpanded ? "lg:col-span-12" : "lg:col-span-7"} rounded-[28px] p-4 sm:p-5 border shadow-lg space-y-3 transition-all ${
                      darkMode
                        ? "bg-[#211F1D] border-white/10"
                        : "bg-[#FCFBF7] border-[#E5DFD3]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${poseBadgeStyle}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {poseDisplayLabel}
                        </span>
                        {isAutoDetect && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Auto AI
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCameraExpanded(!cameraExpanded)}
                          className={`px-2.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
                            darkMode
                              ? "border-white/10 bg-white/5 hover:bg-white/10 text-stone-200"
                              : "border-[#E5DFD3] bg-[#F5F2EA] hover:bg-[#ECE7DA] text-[#3E362E]"
                          }`}
                          title={cameraExpanded ? "Thu nhỏ màn hình" : "Phóng to màn hình"}
                        >
                          {cameraExpanded ? (
                            <>
                              <Minimize2 className="w-3.5 h-3.5" /> Thu nhỏ
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-3.5 h-3.5" /> Phóng to
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setIsAutoDetect(!isAutoDetect)}
                          className={`p-1.5 rounded-full border text-xs transition-colors cursor-pointer ${
                            isAutoDetect
                              ? "text-[#6E8E72] border-[#6E8E72]/40 bg-[#6E8E72]/10 font-bold"
                              : "text-stone-400 border-white/10 hover:bg-stone-500/10"
                          }`}
                          title={
                            isAutoDetect
                              ? "Đang bật AI Tự động từ camera"
                              : "Đang ở chế độ Thủ công"
                          }
                        >
                          <Cpu className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowCameraPip(!showCameraPip)}
                          className="cursor-pointer text-stone-400 hover:text-stone-600 p-1.5 rounded-full border border-transparent hover:border-black/10"
                          title={showCameraPip ? "Ẩn camera" : "Hiện camera"}
                        >
                          {showCameraPip ? (
                            <CameraOff className="w-4 h-4" />
                          ) : (
                            <Camera className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {showCameraPip ? (
                      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black relative border border-white/10">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />

                        {cameraStatus === "active" && (
                          <div className="absolute inset-0 pointer-events-none p-3 sm:p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="bg-black/65 backdrop-blur-xs text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                                <Activity className="w-3 h-3 animate-pulse" />
                                {visionEngine === "mediapipe-wasm" && hasPhoneDetector
                                  ? "MediaPipe WASM • Phone & Person AI"
                                  : visionEngine === "mediapipe-wasm"
                                    ? "MediaPipe WASM (Đang nạp Phone AI...)"
                                    : "Edge Vision RAM"}
                              </span>

                              <div className="flex items-center gap-2">
                                {cameraExpanded && (
                                  <span className="bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg border border-white/15 font-bold">
                                    ⏱ {formatTime(secondsLeft)} • Focus {focusIndex}%
                                  </span>
                                )}
                                <span className="bg-black/65 backdrop-blur-xs text-white/90 px-2.5 py-1 rounded-lg">
                                  Góc cúi: {headTiltAngle}°
                                </span>
                              </div>
                            </div>

                            <div className="self-center w-36 sm:w-44 h-24 sm:h-28 border border-emerald-400/40 rounded-2xl flex flex-col items-center justify-center relative">
                              <div className="w-3 h-3 border-t-2 border-l-2 border-emerald-400 absolute top-0 left-0" />
                              <div className="w-3 h-3 border-t-2 border-r-2 border-emerald-400 absolute top-0 right-0" />
                              <div className="w-3 h-3 border-b-2 border-l-2 border-emerald-400 absolute bottom-0 left-0" />
                              <div className="w-3 h-3 border-b-2 border-r-2 border-emerald-400 absolute bottom-0 right-0" />
                              <span className="text-[11px] text-emerald-400/95 font-mono font-semibold">
                                CONF: {postureConfidence}%
                              </span>
                              <span className="text-[10px] text-cyan-300/90 font-mono">
                                Blink: {blinkCount}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span
                                className={`px-2.5 py-1 rounded-lg ${
                                  isLiveSubject
                                    ? "bg-black/65 text-emerald-300"
                                    : "bg-rose-950/85 text-rose-300"
                                }`}
                              >
                                {isLiveSubject
                                  ? `Liveness ${livenessScore}%`
                                  : "⚠️ Nghi ngờ ảnh tĩnh"}
                              </span>
                              <span className="bg-black/50 text-white/75 px-2 py-0.5 rounded-lg">
                                Zero-Video-Upload
                              </span>
                            </div>
                          </div>
                        )}

                        {cameraStatus === "blocked" && (
                          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-4 text-stone-300">
                            <AlertTriangle className="w-7 h-7 text-amber-400 mb-2" />
                            <span className="text-sm font-bold text-amber-300">
                              Camera đang tối / bị che
                            </span>
                            <p className="text-xs opacity-75 mt-1">
                              Hãy mở cần gạt camera hoặc dùng các nút giả lập bên dưới.
                            </p>
                          </div>
                        )}

                        {cameraStatus === "error" && (
                          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-4 text-stone-300">
                            <CameraOff className="w-7 h-7 text-rose-400 mb-2" />
                            <span className="text-sm font-bold text-rose-300">
                              Chưa cấp quyền Camera
                            </span>
                            <p className="text-xs opacity-75 mt-1">
                              Hãy cho phép webcam hoặc dùng các nút giả lập bên dưới để test.
                            </p>
                          </div>
                        )}

                        {currentPose === "Phone Distraction" && (
                          <div className="absolute inset-0 bg-rose-950/80 flex flex-col items-center justify-center text-white text-center p-4 animate-pulse">
                            <Smartphone className="w-8 h-8 mb-1.5 text-rose-400 animate-bounce" />
                            <span className="text-sm font-bold text-rose-200">
                              Cảnh báo cầm điện thoại! ({distractionSeconds}s)
                            </span>
                            <span className="text-xs text-rose-300 mt-1">
                              {isDistractionAlert
                                ? "Đã tạm dừng Pomodoro & phát chuông!"
                                : `Sẽ tạm dừng đồng hồ sau ${Math.max(0, 5 - distractionSeconds)}s`}
                            </span>
                          </div>
                        )}

                        {currentPose === "Drowsy / Absent" && (
                          <div className="absolute inset-0 bg-amber-950/85 flex flex-col items-center justify-center text-white text-center p-4 animate-pulse">
                            <AlertTriangle className="w-8 h-8 mb-1.5 text-amber-400 animate-bounce" />
                            <span className="text-sm font-bold text-amber-200">
                              Không phát hiện người trong khung hình! ({absenceSeconds}s)
                            </span>
                            <span className="text-xs text-amber-300 mt-1">
                              {isPausedByAi
                                ? "Đã tạm dừng Pomodoro & phát chuông!"
                                : `Sẽ tạm dừng đồng hồ sau ${Math.max(0, 5 - absenceSeconds)}s`}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-2xl bg-black/20 border border-dashed border-black/15 dark:border-white/15 flex flex-col items-center justify-center gap-2 text-xs opacity-75">
                        <CameraOff className="w-6 h-6" />
                        <span>Camera đang tạm ẩn — bấm biểu tượng Camera để bật lại</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1 pt-0.5">
                      <span className="text-stone-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#6E8E72]" />
                        {isAutoDetect
                          ? "Camera AI đang tự động nhận diện (cầm điện thoại / rời khung hình sẽ cảnh báo; 2 tay lên đầu = Suy nghĩ/Nghỉ)"
                          : "Đang chọn tư thế thủ công"}
                      </span>
                      {!isAutoDetect && (
                        <button
                          onClick={() => setIsAutoDetect(true)}
                          className="text-[#6E8E72] hover:underline font-semibold cursor-pointer"
                        >
                          Bật lại Auto AI
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      {(
                        [
                          { pose: "Writing Pose", label: "Cúi viết", icon: PenTool, danger: false },
                          { pose: "Reading Pose", label: "Đọc sách", icon: BookOpenCheck, danger: false },
                          { pose: "Screen Focus", label: "Màn hình", icon: Monitor, danger: false },
                          { pose: "Phone Distraction", label: "Điện thoại", icon: Smartphone, danger: true },
                          { pose: "Drowsy / Absent", label: "Rời ghế", icon: AlertTriangle, danger: true },
                        ] as { pose: StudyPose; label: string; icon: any; danger: boolean }[]
                      ).map((btn) => {
                        const Icon = btn.icon;
                        const isSelected = currentPose === btn.pose;
                        return (
                          <button
                            key={btn.pose}
                            onClick={() => selectManualPose(btn.pose)}
                            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                              isSelected
                                ? btn.danger
                                  ? "bg-rose-600 text-white border-rose-600 shadow-xs font-semibold animate-pulse"
                                  : "bg-[#6E8E72] text-white border-[#6E8E72] shadow-xs font-semibold"
                                : btn.danger
                                  ? "bg-[#F3EFE6] dark:bg-white/5 text-rose-700 dark:text-rose-400 border-transparent hover:border-rose-400/30"
                                  : "bg-[#F3EFE6] dark:bg-white/5 text-[#5C5349] dark:text-stone-300 border-transparent hover:border-black/10"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" /> {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CỘT ĐỒNG HỒ POMODORO & THÔNG TIN PHIÊN */}
                  <div
                    className={`${
                      cameraExpanded
                        ? "lg:col-span-12 max-w-[560px] mx-auto w-full"
                        : "lg:col-span-5"
                    } rounded-[28px] p-6 sm:p-7 border transition-all duration-300 ${
                      darkMode
                        ? "bg-[#211F1D] border-white/10 shadow-2xl"
                        : "bg-[#FCFBF7] border-[#EAE4D7] shadow-[0_16px_48px_rgba(45,38,32,0.07)]"
                    }`}
                  >
                    <div className="text-center space-y-1 mb-4">
                      <span className="text-[11px] uppercase tracking-wider text-[#6E8E72] font-semibold">
                        Chủ đề đang học
                      </span>
                      <h3 className="text-lg sm:text-xl font-bold leading-snug">
                        {activeTopicLabel}
                      </h3>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                        <span
                          className={`px-3.5 py-1 rounded-full text-xs font-medium tracking-wide ${
                            isPausedByAi
                              ? "bg-rose-600 text-white animate-pulse"
                              : currentPose === "Thinking / Rest"
                                ? "bg-sky-600 text-white"
                                : "bg-[#6E8E72] text-white"
                          }`}
                        >
                          {isPausedByAi
                            ? `⏸️ Tạm dừng AI: ${currentPose}`
                            : poseDisplayLabel}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            focusIndex >= 80
                              ? "bg-emerald-500/10 border-emerald-500/30 text-[#6E8E72]"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-600 animate-pulse"
                          }`}
                        >
                          Focus: {focusIndex}%
                        </span>
                      </div>

                      {isPausedByAi && (
                        <div className="mb-3 w-full px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-center gap-2 font-medium animate-pulse">
                          <PauseCircle className="w-4 h-4 shrink-0" />
                          <span>
                            Đồng hồ đã tạm dừng do{" "}
                            {currentPose === "Phone Distraction"
                              ? "phát hiện dùng điện thoại"
                              : "vắng mặt / ngủ gục"}
                            ! Hãy quay lại tư thế học tập.
                          </span>
                        </div>
                      )}

                      <div className="relative w-60 h-60 flex items-center justify-center my-1">
                        <svg
                          className="w-full h-full -rotate-90 transform"
                          viewBox="0 0 256 256"
                        >
                          <circle
                            cx="128"
                            cy="128"
                            r={circleRadius}
                            stroke={darkMode ? "rgba(255,255,255,0.08)" : "#EFECE4"}
                            strokeWidth="8"
                            fill="transparent"
                          />
                          <circle
                            cx="128"
                            cy="128"
                            r={circleRadius}
                            stroke={
                              currentPose === "Phone Distraction" ||
                              currentPose === "Drowsy / Absent"
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

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span
                            className={`text-5xl font-bold tracking-wider tabular-nums font-mono transition-transform ${
                              !isPausedByAi ? "scale-105" : ""
                            }`}
                          >
                            {formatTime(secondsLeft)}
                          </span>
                          <span className="text-[11px] opacity-65 mt-1.5 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-[#6E8E72]" />
                            Camera AI xử lý trên RAM
                          </span>
                        </div>
                      </div>

                      <div
                        className={`mt-4 w-full p-3 rounded-2xl border text-xs space-y-1 ${
                          darkMode
                            ? "bg-[#181715] border-white/5 text-stone-300"
                            : "bg-[#F7F4EC] border-[#E8E2D5] text-[#5C5349]"
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5 text-[#6E8E72]">
                            <ShieldCheck className="w-3.5 h-3.5" /> StudyStakeVault
                          </span>
                          <span className="font-mono text-[10px] opacity-75">
                            {CONTRACTS.VAULT.slice(0, 6)}...{CONTRACTS.VAULT.slice(-4)}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          Cọc 0.01 AVAX đang được bảo vệ. Hoàn tất để chọn nói Feynman 30s hoặc làm Quiz 5 câu!
                        </p>
                      </div>

                      <div className="flex flex-col gap-2.5 w-full mt-5">
                        <button
                          onClick={() => {
                            setIsStudying(false);
                            setShowAssessmentChoice(true);
                          }}
                          className="w-full px-6 py-3.5 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] text-white text-sm font-semibold shadow-md transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Hoàn thành phiên học → Chọn bài kiểm tra
                        </button>
                        <button
                          onClick={handleResetOrChange}
                          className={`w-full px-5 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                            darkMode
                              ? "bg-white/5 border-white/10 text-stone-300 hover:bg-white/10"
                              : "bg-[#F6F3EB] border-[#E6E0D4] text-[#3E362E] hover:bg-[#ECE7DA]"
                          }`}
                        >
                          Hủy / Quay lại màn hình chính
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* B. MÀN HÌNH CHỌN PHƯƠNG THỨC ĐÁNH GIÁ SAU PHIÊN HỌC (KHÔNG ÉP NÓI LIỀN) */}
              {showAssessmentChoice && !isStudying && feynmanStep === "idle" && (
                <div
                  className={`w-full max-w-[680px] rounded-[32px] p-7 sm:p-9 border space-y-6 animate-in fade-in zoom-in-95 duration-300 ${
                    darkMode
                      ? "bg-[#211F1D] border-white/10 shadow-2xl"
                      : "bg-[#FCFBF7] border-[#EAE4D7] shadow-[0_16px_48px_rgba(45,38,32,0.08)]"
                  }`}
                >
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5" /> Hoàn thành phiên tập trung!
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold">
                      🎉 Chúc mừng bạn đã hoàn thành giờ học!
                    </h2>
                    <p
                      className={`text-sm ${darkMode ? "text-stone-300" : "text-[#5C5349]"}`}
                    >
                      Chủ đề: <strong className="font-bold">{activeTopicLabel}</strong>
                    </p>
                    <p
                      className={`text-xs ${darkMode ? "text-stone-400" : "text-[#7A7167]"}`}
                    >
                      Hãy chọn hình thức phản tư phù hợp với bạn lúc này để Oracle xác thực và hoàn trả 0.01 AVAX cọc + thưởng:
                    </p>
                  </div>

                  {breakSecondsLeft !== null && (
                    <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
                        <Coffee className="w-5 h-5" />
                        <span>
                          Đang nghỉ giải lao ngắn:{" "}
                          <span className="font-mono font-bold">
                            {formatTime(breakSecondsLeft)}
                          </span>
                        </span>
                      </div>
                      <button
                        onClick={() => setBreakSecondsLeft(null)}
                        className="px-4 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Sẵn sàng kiểm tra ngay
                      </button>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={startFeynmanRecording}
                      className={`text-left p-5 rounded-2xl border-2 transition-all hover:-translate-y-0.5 cursor-pointer space-y-2 ${
                        darkMode
                          ? "bg-[#181715] border-[#6E8E72]/50 hover:border-[#6E8E72]"
                          : "bg-[#F5F8F5] border-[#6E8E72]/40 hover:border-[#6E8E72]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#6E8E72] text-white flex items-center justify-center">
                        <Mic className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-base">
                        🎙️ Thuyết trình Feynman 30s
                      </div>
                      <p className="text-xs opacity-80 leading-relaxed">
                        Nói tóm tắt lại bài bằng giọng của bạn (≥ 15 từ). Có màn hình nghe lại & xem văn bản AI nghe được trước khi chấm!
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBreakSecondsLeft(null);
                        setShowAssessmentChoice(false);
                        setQuizModalOpen(true);
                      }}
                      className={`text-left p-5 rounded-2xl border-2 transition-all hover:-translate-y-0.5 cursor-pointer space-y-2 ${
                        darkMode
                          ? "bg-[#181715] border-amber-500/40 hover:border-amber-400"
                          : "bg-amber-50/70 border-amber-500/35 hover:border-amber-600"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-base">
                        📝 Làm Quiz trắc nghiệm 5 câu
                      </div>
                      <p className="text-xs opacity-80 leading-relaxed">
                        Yên tĩnh không cần nói — trả lời đúng ≥ 3/5 câu trắc nghiệm do Gemini AI soạn theo chủ đề của bạn.
                      </p>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                    {breakSecondsLeft === null ? (
                      <button
                        type="button"
                        onClick={() => setBreakSecondsLeft(breakMinutes * 60)}
                        className={`px-4 py-2 rounded-full text-xs font-medium border flex items-center gap-1.5 cursor-pointer ${
                          darkMode
                            ? "border-white/15 bg-white/5 hover:bg-white/10 text-stone-200"
                            : "border-[#E5DFD3] bg-[#F5F2EA] hover:bg-[#ECE7DA] text-[#3E362E]"
                        }`}
                      >
                        <Coffee className="w-3.5 h-3.5 text-amber-500" />
                        Nghỉ giải lao {breakMinutes} phút (tắt Camera AI, không mất cọc) rồi đánh giá sau
                      </button>
                    ) : (
                      <span className="text-xs opacity-70">
                        Chọn bất kỳ chế độ nào ở trên khi bạn sẵn sàng.
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleResetOrChange}
                      className="text-xs opacity-70 hover:opacity-100 underline cursor-pointer"
                    >
                      Quay lại màn hình chính
                    </button>
                  </div>
                </div>
              )}

              {/* C. KHU VỰC FEYNMAN 2 BƯỚC: GHI ÂM + XEM LẠI TRANSCRIPT & CHẤM ĐIỂM */}
              {feynmanStep !== "idle" && (
                <div
                  className={`w-full max-w-[680px] rounded-[32px] p-7 sm:p-9 border space-y-5 animate-in fade-in duration-300 ${
                    darkMode
                      ? "bg-[#211F1D] border-white/10 shadow-2xl"
                      : "bg-[#FCFBF7] border-[#EAE4D7] shadow-[0_16px_48px_rgba(45,38,32,0.08)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#6E8E72] font-semibold">
                        Phản tư Feynman • Bước{" "}
                        {feynmanStep === "recording" || feynmanStep === "transcribing"
                          ? "1/2 (Ghi âm & Nhận diện)"
                          : "2/2 (Kiểm tra & Chấm điểm)"}
                      </span>
                      <h3 className="text-lg sm:text-xl font-bold mt-0.5">
                        {activeTopicLabel}
                      </h3>
                    </div>

                    {feynmanStep === "recording" && (
                      <span className="text-2xl font-mono font-bold px-4 py-1.5 rounded-full bg-[#6E8E72]/15 text-[#6E8E72] tabular-nums">
                        00:{feynmanSeconds.toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>

                  {feynmanStep === "recording" && (
                    <div className="space-y-5 py-2 text-center">
                      <div className="flex items-end justify-center gap-1.5 h-20 px-4">
                        {audioLevels.map((lvl, idx) => (
                          <div
                            key={idx}
                            className={`w-2 rounded-full transition-all duration-100 ${
                              micStatus === "error"
                                ? "bg-rose-400/60"
                                : micStatus === "quiet"
                                  ? "bg-amber-400"
                                  : "bg-[#6E8E72]"
                            }`}
                            style={{ height: `${lvl}%` }}
                          />
                        ))}
                      </div>

                      <div className="flex justify-center">
                        <span
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                            micStatus === "error"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                              : micStatus === "quiet"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 animate-pulse"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          {micStatus === "error"
                            ? "Không truy cập được Micro — hãy chuyển sang gõ tóm tắt hoặc làm Quiz"
                            : micStatus === "quiet"
                              ? "Mic đang hơi nhỏ — hãy nói to rõ ràng hoặc đưa mic lại gần hơn"
                              : "Micro đang bắt sóng giọng nói tốt — hãy giải thích như đang dạy lại cho bạn bè"}
                        </span>
                      </div>

                      {feynmanNotice && (
                        <div className="text-xs p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                          {feynmanNotice}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleStopAndTranscribe}
                          className="px-6 py-3 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] text-white text-sm font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          ⏹ Dừng & Xem bản chép AI
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRecordingFeynman(false);
                            setFeynmanStep("idle");
                            setQuizModalOpen(true);
                          }}
                          className={`px-4 py-3 rounded-full text-xs font-semibold border cursor-pointer flex items-center gap-1.5 ${
                            darkMode
                              ? "border-white/15 bg-white/5 hover:bg-white/10 text-amber-300"
                              : "border-amber-600/30 bg-amber-50 hover:bg-amber-100 text-amber-800"
                          }`}
                        >
                          <BrainCircuit className="w-4 h-4" /> Chuyển sang Quiz 5 câu
                        </button>
                      </div>
                    </div>
                  )}

                  {feynmanStep === "transcribing" && (
                    <div className="py-14 flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#6E8E72]" />
                      <div className="text-sm font-semibold">
                        Groq Whisper đang chuyển giọng nói của bạn thành văn bản...
                      </div>
                      <p className="text-xs opacity-70">
                        Vui lòng đợi vài giây, sau đó bạn có thể nghe lại và chỉnh sửa nếu AI nghe nhầm.
                      </p>
                    </div>
                  )}

                  {(feynmanStep === "review" || feynmanStep === "grading") && (
                    <div className="space-y-4">
                      {feynmanNotice && (
                        <div className="text-xs p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-700 dark:text-amber-300 leading-relaxed">
                          ⚠️ {feynmanNotice}
                        </div>
                      )}

                      {recordedAudioUrl && (
                        <div
                          className={`p-3.5 rounded-2xl border space-y-1.5 ${
                            darkMode
                              ? "bg-[#181715] border-white/10"
                              : "bg-[#F6F3EB] border-[#E6E0D4]"
                          }`}
                        >
                          <div className="text-xs font-semibold opacity-80">
                            🔊 Nghe lại đoạn ghi âm của bạn:
                          </div>
                          <audio controls src={recordedAudioUrl} className="w-full h-10" />
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold">
                            Văn bản AI nghe được (bạn có thể chỉnh sửa lại nếu AI nghe nhầm từ):
                          </label>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-semibold ${
                              transcriptWordCount >= 15
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {transcriptWordCount}/15 từ tối thiểu
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={editableTranscript}
                          onChange={(e) => setEditableTranscript(e.target.value)}
                          disabled={feynmanStep === "grading"}
                          placeholder="Nếu mic chưa thu rõ, bạn cũng có thể gõ phần tóm tắt kiến thức của bạn tại đây (tối thiểu 15 từ)..."
                          className={`w-full p-4 rounded-2xl border-2 text-sm leading-relaxed focus:outline-none focus:border-[#6E8E72] ${
                            darkMode
                              ? "bg-[#181715] border-white/10 text-[#F3EFE6]"
                              : "bg-white border-[#E5DFD3] text-[#2D2620]"
                          }`}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={feynmanStep === "grading"}
                            onClick={startFeynmanRecording}
                            className={`px-4 py-2.5 rounded-full text-xs font-semibold border cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                              darkMode
                                ? "border-white/15 bg-white/5 hover:bg-white/10 text-stone-200"
                                : "border-[#E5DFD3] bg-[#F5F2EA] hover:bg-[#ECE7DA] text-[#3E362E]"
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Thu âm lại
                          </button>
                          <button
                            type="button"
                            disabled={feynmanStep === "grading"}
                            onClick={() => {
                              setFeynmanStep("idle");
                              setQuizModalOpen(true);
                            }}
                            className={`px-4 py-2.5 rounded-full text-xs font-semibold border cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                              darkMode
                                ? "border-white/15 bg-white/5 hover:bg-white/10 text-amber-300"
                                : "border-amber-600/30 bg-amber-50 hover:bg-amber-100 text-amber-800"
                            }`}
                          >
                            <BrainCircuit className="w-3.5 h-3.5" /> Chuyển sang Quiz 5 câu
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={feynmanStep === "grading" || !editableTranscript.trim()}
                          onClick={handleEvaluateTranscript}
                          className="px-6 py-3 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] disabled:opacity-50 text-white text-sm font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          {feynmanStep === "grading" ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> AI đang chấm & cấp Proof...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" /> Gửi AI chấm điểm & Cấp Proof
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* D. MÀN HÌNH THIẾT LẬP PHIÊN HỌC (IDLE) */}
              {isFocusIdle && (
                <>
                  <div
                    className={`w-full max-w-[580px] rounded-[32px] p-7 sm:p-9 border transition-all duration-300 ${
                      darkMode
                        ? "bg-[#211F1D] border-white/10 shadow-2xl"
                        : "bg-[#FCFBF7] border-[#EAE4D7] shadow-[0_16px_48px_rgba(45,38,32,0.07)]"
                    }`}
                  >
                    {/* Chủ đề phiên học (In đậm, tự do nhập, không ép mặc định) */}
                    <div className="mb-5 space-y-2">
                      <label
                        className={`block text-sm font-bold pl-1 ${darkMode ? "text-stone-200" : "text-[#2D2620]"}`}
                      >
                        Chủ đề học tập hôm nay
                      </label>
                      <input
                        value={studyTopic}
                        onChange={(e) => setStudyTopic(e.target.value)}
                        placeholder="Nhập môn học hoặc chủ đề bạn muốn học hôm nay (vd: Giải tích, Lập trình Web3, Triết học...)"
                        className={`w-full h-14 px-5 rounded-2xl border-2 text-lg sm:text-xl font-bold placeholder:font-normal placeholder:text-sm sm:placeholder:text-base focus:outline-none focus:border-[#6E8E72] focus:ring-2 focus:ring-[#6E8E72]/20 transition-all ${
                          darkMode
                            ? "bg-[#181715] border-white/15 text-[#F3EFE6] placeholder:text-stone-500"
                            : "bg-white border-[#E0D9CA] text-[#2D2620] placeholder:text-[#9A9084]"
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] opacity-65 mr-1">Gợi ý nhanh:</span>
                        {TOPIC_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setStudyTopic(preset)}
                            className={`text-[11px] px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors ${
                              studyTopic === preset
                                ? "bg-[#6E8E72]/20 border-[#6E8E72] text-[#6E8E72] font-semibold"
                                : darkMode
                                  ? "border-white/10 text-stone-400 hover:text-stone-200"
                                  : "border-[#E6E0D4] text-[#7A7167] hover:bg-[#F3EFE6]"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hai ô điều chỉnh Study Time & Break Time */}
                    <div className="grid grid-cols-2 gap-4 mb-5">
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
                            className="p-1.5 rounded-full hover:bg-black/5 transition-transform active:scale-90 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-sm tabular-nums">
                            {studyMinutes}
                          </span>
                          <button
                            onClick={() => handleAdjustStudyTime(5)}
                            className="p-1.5 rounded-full hover:bg-black/5 transition-transform active:scale-90 cursor-pointer"
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
                            className="p-1.5 rounded-full hover:bg-black/5 transition-transform active:scale-90 cursor-pointer"
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
                            className="p-1.5 rounded-full hover:bg-black/5 transition-transform active:scale-90 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] opacity-65 pl-1">
                          Nghỉ ngắn giữa phiên — Camera AI tắt, cọc vẫn an toàn
                        </p>
                      </div>
                    </div>

                    {/* Smart Session Recovery Banner (khi lỡ F5 / thoát web nhưng ví vẫn đang stake) */}
                    {isConnected && hasActiveOnChainSession && (
                      <div className="mb-5 p-4 rounded-2xl border border-emerald-500/45 bg-emerald-500/10 text-xs space-y-3">
                        <div>
                          <div className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                            ⚡ Phiên cọc 0.01 AVAX của bạn đang được bảo vệ trên Fuji!
                          </div>
                          <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed">
                            Mục tiêu contract: {onChainTargetMinutes} phút. Nếu lỡ thoát web bạn không hề bị mất cọc — hãy chọn tiếp tục học hoặc hoàn thành đánh giá để rút cọc ngay (sau khi rút xong có thể học tiếp phiên mới bình thường).
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleResumeExistingSession}
                            className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> Tiếp tục phiên học
                          </button>
                          <button
                            onClick={() => setShowAssessmentChoice(true)}
                            className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            🔓 Kết thúc & Rút cọc ngay
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Đồng hồ tròn + Hộp Vault */}
                    <div className="flex flex-col items-center">
                      <span className="px-4 py-1 rounded-full text-xs font-medium tracking-wide bg-[#6E8E72] text-white mb-4">
                        Sẵn sàng vào phiên học
                      </span>

                      <div className="relative w-60 h-60 flex items-center justify-center my-1">
                        <svg
                          className="w-full h-full -rotate-90 transform"
                          viewBox="0 0 256 256"
                        >
                          <circle
                            cx="128"
                            cy="128"
                            r={circleRadius}
                            stroke={darkMode ? "rgba(255,255,255,0.08)" : "#EFECE4"}
                            strokeWidth="8"
                            fill="transparent"
                          />
                          <circle
                            cx="128"
                            cy="128"
                            r={circleRadius}
                            stroke="#6E8E72"
                            strokeWidth="8"
                            strokeDasharray={circleCircumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                          />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-5xl sm:text-6xl font-bold tracking-wider tabular-nums font-mono">
                            {formatTime(secondsLeft)}
                          </span>
                          <span className="text-[11px] opacity-60 mt-1.5 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-[#6E8E72]" />
                            Cọc cam kết: 0.01 AVAX
                          </span>
                        </div>
                      </div>

                      <div
                        className={`mt-4 w-full p-3.5 rounded-2xl border text-xs space-y-1 ${
                          darkMode
                            ? "bg-[#181715] border-white/5 text-stone-300"
                            : "bg-[#F7F4EC] border-[#E8E2D5] text-[#5C5349]"
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5 text-[#6E8E72]">
                            <ShieldCheck className="w-3.5 h-3.5" /> Nơi nạp cọc:
                            StudyStakeVault
                          </span>
                          <span className="font-mono text-[10px] opacity-75">
                            {CONTRACTS.VAULT.slice(0, 6)}...{CONTRACTS.VAULT.slice(-4)}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          0.01 AVAX được khóa an toàn trên Avalanche Fuji. Hệ thống hoàn cọc 100% + học bổng x402 + điểm EXP SBT khi hoàn thành!
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2.5 w-full mt-5">
                        <button
                          onClick={handleStartSession}
                          disabled={isStakingTx}
                          className="px-7 py-3 rounded-full bg-[#6E8E72] hover:bg-[#5d7a61] disabled:opacity-60 text-white text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          {isStakingTx ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Đang xác nhận trên Fuji...
                            </>
                          ) : hasActiveOnChainSession ? (
                            "Tiếp tục phiên đã Stake"
                          ) : (
                            "Start (Stake 0.01 AVAX)"
                          )}
                        </button>

                        {hasActiveOnChainSession && (
                          <button
                            onClick={() => setShowAssessmentChoice(true)}
                            className={`px-4 py-3 rounded-full text-xs font-medium border cursor-pointer flex items-center gap-1.5 ${
                              darkMode
                                ? "bg-white/5 border-white/15 text-amber-300 hover:bg-white/10"
                                : "bg-amber-50 border-amber-500/30 text-amber-800 hover:bg-amber-100"
                            }`}
                          >
                            <BrainCircuit className="w-3.5 h-3.5" /> Mở bài kiểm tra rút cọc
                          </button>
                        )}

                        <button
                          onClick={handleResetOrChange}
                          className={`px-5 py-3 rounded-full text-sm font-medium border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            darkMode
                              ? "bg-white/5 border-white/10 text-stone-300 hover:bg-white/10"
                              : "bg-[#F6F3EB] border-[#E6E0D4] text-[#3E362E] hover:bg-[#ECE7DA]"
                          }`}
                        >
                          Reset
                        </button>
                      </div>

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
                          Xem quy trình 4 bước <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* KHU VỰC PHÒNG HỌC NHÓM (STUDY GUILD) */}
                  {studyMode === "group" && (
                    <div
                      className={`w-full max-w-3xl rounded-[28px] p-6 border space-y-4 animate-in fade-in duration-300 ${
                        darkMode
                          ? "bg-[#211F1D] border-white/10"
                          : "bg-[#FCFBF7] border-[#EAE4D7] shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#6E8E72]" /> Thành viên
                            đang học chung phòng
                          </h3>
                          <p
                            className={`text-xs ${darkMode ? "text-stone-400" : "text-[#7A7167]"}`}
                          >
                            Cả phòng cùng cam kết cọc AVAX để giữ kỷ luật học tập.
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                          🟢 Tỷ lệ kỷ luật: 98.2%
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div
                          className={`p-3 rounded-2xl border space-y-2 ${
                            darkMode
                              ? "bg-[#181715] border-white/5"
                              : "bg-[#F7F4EC] border-[#E8E2D5]"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-[#6E8E72]">
                              <UserCheck className="w-3.5 h-3.5" /> Bạn
                            </span>
                            <span className="text-[10px] text-emerald-600">
                              Sẵn sàng
                            </span>
                          </div>
                          <div className="aspect-video rounded-xl bg-black/10 flex items-center justify-center font-mono text-xs">
                            0.01 AVAX
                          </div>
                          <div className="text-[10px] font-mono opacity-70 truncate">
                            {address
                              ? `${address.slice(0, 6)}...${address.slice(-4)}`
                              : "Chưa kết nối"}
                          </div>
                        </div>

                        {groupPeers.map((peer) => (
                          <div
                            key={peer.id}
                            className={`p-3 rounded-2xl border space-y-2 ${
                              darkMode
                                ? "bg-[#181715] border-white/5"
                                : "bg-[#F7F4EC] border-[#E8E2D5]"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="truncate">{peer.name}</span>
                              <span className="text-[10px] text-emerald-600">
                                {peer.status}
                              </span>
                            </div>
                            <div
                              className={`aspect-video rounded-xl bg-gradient-to-br ${peer.avatarBg} text-white flex flex-col items-center justify-center p-2 text-center`}
                            >
                              <span className="font-mono font-bold text-sm">
                                {peer.minsLeft}m
                              </span>
                              <span className="text-[9px] line-clamp-1 opacity-90">
                                {peer.topic}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] opacity-70">
                              <span className="truncate">{peer.school}</span>
                              <span className="font-mono">{peer.address}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div
                        className={`text-[11px] p-2.5 rounded-xl border flex items-center justify-between ${
                          darkMode
                            ? "bg-black/30 border-white/5 text-stone-400"
                            : "bg-[#F3EFE6] border-[#E5DFD3] text-[#6E655C]"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-500" />
                          <strong>Hoạt động nhóm:</strong> Alex Nguyễn vừa hoàn thành
                          phiên (+0.011 AVAX) • Minh Trần vừa lên Level 2 SBT!
                        </span>
                        <span className="text-[10px] font-mono text-[#6E8E72]">
                          Sync ✔
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 3 Thẻ Tóm tắt Tính năng nổi bật */}
                  <div className="grid sm:grid-cols-3 gap-3.5 w-full max-w-3xl pt-2">
                    {[
                      {
                        icon: Eye,
                        title: "Edge-AI Studio Màn Hình Lớn",
                        desc: "Nhận diện tư thế cúi viết, đọc sách, phân biệt đưa 2 tay lên đầu suy nghĩ & tránh cảnh báo nhầm điện thoại.",
                      },
                      {
                        icon: Mic,
                        title: "Tự Chọn Feynman hoặc Quiz",
                        desc: "Hết giờ được chọn nói tóm tắt (nghe lại & sửa văn bản AI), làm Quiz 5 câu hoặc nghỉ giải lao ngắn.",
                      },
                      {
                        icon: Coins,
                        title: "Học bổng x402 & EXP SBT",
                        desc: "Hoàn cọc an toàn ngay cả khi lỡ thoát web, minh bạch thưởng x402 và nâng cấp Huy hiệu NFT.",
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
                </>
              )}
            </div>
          );
        })()}

        {/* 2. TAB HUY HIỆU SOULBOUND (SKILL TREE), x402 & REWARD MARKETPLACE */}
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
                <div className="w-44 h-44 rounded-2xl overflow-hidden bg-[#0f172a] border border-[#E5DFD3] flex items-center justify-center">
                  {sbtSvgImage ? (
                    <img
                      src={sbtSvgImage}
                      alt="Soulbound Badge"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="space-y-2 p-4 text-center text-slate-200">
                      <ShieldCheck className="w-12 h-12 text-[#CD7F32] mx-auto" />
                      <div className="text-xs font-bold">LVL {sbtLevel} PREVIEW</div>
                      <div className="text-[10px] text-slate-400">
                        Hoàn thành 1 phiên để mint thẻ SBT thật on-chain
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-[#6E8E72] font-semibold">
                    {userHasPersonalBadge
                      ? `Soulbound Token #${studentBadgeId?.toString()}`
                      : "Soulbound Skill Tree"}
                  </span>
                  <h3 className="text-xl font-bold mt-0.5">
                    Scholar Level {sbtLevel}
                  </h3>
                  <p className="text-xs text-[#8C8275] mt-1">
                    {sbtMinutes} phút • {sbtSessions} phiên • TB {sbtAvgScore || 0}/100
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
                            : darkMode
                              ? "bg-white/5 border-white/10 opacity-55"
                              : "bg-[#F3EFE6]/60 border-[#E5DFD3] opacity-60"
                        }`}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full mx-auto mb-1.5 ${tier.color}`}
                        />
                        <div>{tier.lv}</div>
                        <div className="text-[10px] opacity-80">{tier.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* KHU VỰC ĐỔI QUÀ NHÀ TÀI TRỢ (REWARD MARKETPLACE - FR-4.3 & MU-24) */}
            <div
              className={`rounded-[28px] p-6 border space-y-4 ${
                darkMode
                  ? "bg-[#211F1D] border-white/10"
                  : "bg-[#FCFBF7] border-[#EAE4D7] shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Gift className="w-4 h-4 text-[#E84142]" /> Reward Marketplace (Quyền lợi SBT)
                  </h3>
                  <p className="text-xs opacity-75">
                    Dùng cấp độ Soulbound NFT để mở khóa học bổng và voucher từ nhà tài trợ.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#6E8E72]/15 text-[#6E8E72]">
                  Cấp của bạn: Level {sbtLevel}
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {REWARD_MARKETPLACE.map((rw) => {
                  const unlocked = sbtLevel >= rw.requiredLevel;
                  const redeemed = redeemedRewards.includes(rw.id);
                  return (
                    <div
                      key={rw.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
                        darkMode
                          ? "bg-[#181715] border-white/10"
                          : "bg-[#F7F4EC] border-[#E8E2D5]"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] opacity-70">
                          <span>{rw.sponsor}</span>
                          <span className="font-semibold text-[#6E8E72]">{rw.pointsCost}</span>
                        </div>
                        <div className="text-xs font-bold leading-snug">{rw.title}</div>
                      </div>

                      {redeemed ? (
                        <div className="text-[11px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 p-2 rounded-xl flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {rw.code}
                        </div>
                      ) : (
                        <button
                          disabled={!unlocked}
                          onClick={() => handleRedeemReward(rw.id, rw.code)}
                          className={`w-full py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            unlocked
                              ? "bg-[#6E8E72] hover:bg-[#5d7a61] text-white"
                              : "bg-black/10 dark:bg-white/5 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          {unlocked ? "Đổi quyền lợi" : `Yêu cầu Level ${rw.requiredLevel}`}
                        </button>
                      )}
                    </div>
                  );
                })}
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
                Tự động tổng hợp thẻ từ Feynman 30s, Quiz Mode B và hỏi đáp
                chuyên sâu qua giao thức x402 ({flashcards.length} thẻ đã lưu).
              </p>
            </div>
            <FlashcardNotebook
              darkMode={darkMode}
              cards={flashcards}
              onAddCard={(card) => appendFlashcards([card])}
            />
          </div>
        )}
      </main>

      {/* CỬA SỔ MODAL "CÁCH HOẠT ĐỘNG" */}
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
                  desc: "Thoải mái cúi viết, đọc sách in. AI chạy cục bộ trên RAM nhận diện tư thế, chớp mắt và tự tạm dừng khi cầm điện thoại.",
                },
                {
                  step: "Bước 3: Phản tư Feynman 30s / Quiz",
                  desc: "Cuối phiên học, nói tóm tắt kiến thức trong 30s hoặc trả lời Quiz 5 câu. AI chấm điểm và tự động tạo thẻ Flashcard.",
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

      {/* MODAL KẾT QUẢ & CLAIM ON-CHAIN */}
      <ResultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sessionResult={sessionResult}
        studyTopic={studyTopic}
        focusIndex={focusIndex}
        sbtLevel={sbtLevel}
        onRetryFeynman={() => startFeynmanRecording()}
        onSwitchToQuiz={() => {
          setShowAssessmentChoice(false);
          setFeynmanStep("idle");
          setQuizModalOpen(true);
        }}
        onRequestDemoAttest={requestDemoAttestFromGateway}
        onClaimSuccess={refreshOnChainState}
        onOpenNotebook={() => setActiveSpace("notebook")}
        onStartNewSession={() => {
          setModalOpen(false);
          refreshOnChainState();
          handleResetOrChange();
        }}
      />

      {/* MODAL QUIZ MODE B (DỰ PHÒNG / ÔN TẬP TRẮC NGHIỆM AI) */}
      <QuizModal
        open={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        topic={studyTopic}
        walletAddress={address || "0xA206B966480E6eeE2F3F96e6958899e71501B8e2"}
        actualMinutes={studyMinutes}
        completedMinutes={activeMinutesForModes}
        darkMode={darkMode}
        onTopicChange={(nextTopic) => setStudyTopic(nextTopic)}
        onAddFlashcards={(cards) => appendFlashcards(cards)}
        onCompleteToResult={handleQuizComplete}
      />
    </div>
  );
}
