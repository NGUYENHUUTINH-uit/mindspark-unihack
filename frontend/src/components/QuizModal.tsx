"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BrainCircuit,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  ArrowRight,
  BookMarked,
  Upload,
  FileText,
  X,
  AlertTriangle,
} from "lucide-react";

export interface QuizFlashcard {
  front: string;
  back: string;
  tag: string;
}

export interface QuizCompletionPayload {
  passed: boolean;
  actualMinutes: number;
  completedMinutes: number;
  feynmanScore: number; // thang 50-100 cho Vault
  llmScore: number; // thang 0-10
  signature?: `0x${string}`;
  aiFeedback: string;
  flashcards: QuizFlashcard[];
  mode: "quiz";
  oracleMock?: boolean;
}

interface QuizQuestionItem {
  id: string;
  question: string;
  options: string[];
}

interface QuizReviewItem {
  question_id: string;
  correct_index: number;
  explanation: string;
}

interface LocalFallbackQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface QuizModalProps {
  open: boolean;
  onClose: () => void;
  topic: string;
  walletAddress: string;
  actualMinutes: number;
  completedMinutes: number;
  darkMode?: boolean;
  onTopicChange?: (nextTopic: string) => void;
  onAddFlashcards: (cards: QuizFlashcard[]) => void;
  onCompleteToResult: (payload: QuizCompletionPayload) => void;
}

function buildFallbackQuestions(topic: string): LocalFallbackQuestion[] {
  const cleanTopic = topic.trim() || "Kiến thức phiên học";
  return [
    {
      id: "fb_1",
      question: `Khi học chủ đề "${cleanTopic}", cách tiếp cận nào giúp xác thực bạn thật sự hiểu bản chất thay vì học vẹt?`,
      options: [
        "Giải thích lại khái niệm cốt lõi bằng ngôn ngữ đơn giản và hoàn thành câu hỏi kiểm tra hiểu bài",
        "Chỉ mở tab tài liệu giữ màn hình sáng mà không cần ôn tập hay phản tư",
        "Học thuộc lòng nguyên văn một câu chữ mà không cần biết ví dụ ứng dụng",
        "Bỏ qua toàn bộ bước tự kiểm tra kiến thức cuối phiên học",
      ],
      correct_index: 0,
      explanation:
        "Phương pháp Feynman kết hợp tự kiểm tra giúp chứng minh nỗ lực nhận thức thực chất.",
    },
    {
      id: "fb_2",
      question: "Phương pháp Feynman giúp người học củng cố kiến thức theo cơ chế nào?",
      options: [
        "Đọc lặp lại nguyên văn sách giáo khoa mà không cần hiểu",
        "Giải thích lại khái niệm cốt lõi bằng ngôn ngữ đơn giản như giảng cho người mới",
        "Chỉ ghi nhớ các từ khóa riêng lẻ để làm bài thi",
        "Tắt mọi hình thức tự kiểm tra sau phiên học",
      ],
      correct_index: 1,
      explanation:
        "Giải thích lại kiến thức bằng ngôn ngữ giản dị giúp bộc lộ ngay lỗ hổng hiểu biết và ghi nhớ sâu.",
    },
    {
      id: "fb_3",
      question: "Vì sao Edge-AI xử lý khung hình camera ngay trên RAM trình duyệt?",
      options: [
        "Để lưu trữ video dài hạn trên máy chủ trung tâm",
        "Để bảo vệ quyền riêng tư tuyệt đối (Zero-Video-Transmission) và giảm độ trễ",
        "Vì trình duyệt không thể gửi request HTTP",
        "Để tăng dung lượng băng thông upload lên cloud",
      ],
      correct_index: 1,
      explanation:
        "Xử lý WebAssembly/Canvas cục bộ đảm bảo 0 khung hình video bị gửi ra ngoài, bảo vệ 100% quyền riêng tư.",
    },
    {
      id: "fb_4",
      question: "Chữ ký EIP-191 kết hợp nonce và chainId trên StudyStakeVault có tác dụng gì?",
      options: [
        "Cho phép dùng lại một chữ ký cũ nhiều lần để rút thưởng",
        "Chống giả mạo điểm số, chống Replay Attack và chống tấn công Cross-Chain",
        "Tự động mở khóa toàn bộ tiền trong ví người dùng",
        "Bỏ qua bước kiểm tra thời gian học cam kết",
      ],
      correct_index: 1,
      explanation:
        "Nonce tăng sau mỗi lần claim kết hợp chainId + contract address ngăn chặn hoàn toàn Replay Attack và sửa đổi tham số.",
    },
    {
      id: "fb_5",
      question: "Giao thức x402 (HTTP 402 Payment Required) trong MindSpark hỗ trợ luồng giá trị nào?",
      options: [
        "Stream học bổng vi mô theo phút học và vi thanh toán mỗi lượt hỏi AI Socratic",
        "Khóa vĩnh viễn tài khoản nếu trả lời sai 1 câu hỏi",
        "Chỉ dùng để lưu ảnh JPEG lên IPFS",
        "Ép người dùng phải mua NFT trước khi mở app",
      ],
      correct_index: 0,
      explanation:
        "x402PaymentRail triển khai thanh toán vi mô 2 chiều: doanh nghiệp tài trợ stream theo phút và sinh viên trả 0.005 AVAX cho truy vấn AI nâng cao.",
    },
  ];
}

export function QuizModal({
  open,
  onClose,
  topic,
  walletAddress,
  actualMinutes,
  completedMinutes,
  darkMode = false,
  onTopicChange,
  onAddFlashcards,
  onCompleteToResult,
}: QuizModalProps) {
  const [step, setStep] = useState<"setup" | "loading" | "quiz">("setup");
  const [draftTopic, setDraftTopic] = useState(topic);
  const [referenceText, setReferenceText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackItems, setFallbackItems] = useState<LocalFallbackQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  // Trạng thái sau khi nộp bài
  const [submitResult, setSubmitResult] = useState<{
    passed: boolean;
    score: number;
    correct: number;
    total: number;
    feedback: string;
    review: QuizReviewItem[];
    flashcards: QuizFlashcard[];
    proofSignature?: `0x${string}`;
    proofScore?: number;
    proofMinutes?: number;
    oracleMock?: boolean;
  } | null>(null);

  const aiServiceUrl =
    process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";
  const gatewayUrl =
    process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4020";

  const loadQuiz = useCallback(
    async (activeTopic?: string, activeReference?: string) => {
      const targetTopic = (activeTopic ?? draftTopic).trim();
      const targetRef = (activeReference ?? referenceText).trim();
      const effectiveTopic =
        targetTopic || uploadedFileName || "Kiến thức tổng hợp phiên học";

      setStep("loading");
      setErrorMsg("");
      setSubmitResult(null);
      setSelectedAnswers({});
      setFallbackMode(false);
      setFallbackItems([]);
      setQuizId(null);

      const sessionId = `quiz_sess_${Date.now()}`;
      const safeWallet =
        /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
          ? walletAddress
          : "0xA206B966480E6eeE2F3F96e6958899e71501B8e2";

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      try {
        const res = await fetch(`${aiServiceUrl}/api/quiz/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            wallet_address: safeWallet,
            topic: effectiveTopic,
            reference_text: targetRef ? targetRef.slice(0, 9500) : undefined,
            num_questions: 5,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`AI Service trả mã ${res.status}`);
        }

        const data = await res.json();
        if (!data.quiz_id || !Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error("Dữ liệu câu hỏi không hợp lệ");
        }

        setQuizId(data.quiz_id);
        setQuestions(data.questions);
      } catch (err: any) {
        clearTimeout(timer);
        console.warn("Không tạo được Quiz từ AI Service, bật chế độ Quiz dự phòng:", err?.message);
        const fb = buildFallbackQuestions(effectiveTopic);
        setFallbackMode(true);
        setFallbackItems(fb);
        setQuestions(fb.map(({ id, question, options }) => ({ id, question, options })));
        setErrorMsg(
          "AI Service đang quá tải hoặc ngoại tuyến — đang dùng bộ câu hỏi dự phòng (Offline). Lưu ý: bộ Offline chưa có chữ ký Oracle nếu Gateway tắt Demo Attest."
        );
      } finally {
        setStep("quiz");
      }
    },
    [aiServiceUrl, draftTopic, referenceText, uploadedFileName, walletAddress]
  );

  // Chỉ khởi tạo khi Modal vừa mở: nếu chưa nhập chủ đề thì dừng ở màn Setup để nhập hoặc upload tài liệu
  useEffect(() => {
    if (!open) return;
    const initialTopic = topic.trim();
    setDraftTopic(topic);
    setUploadError("");
    setErrorMsg("");
    setSubmitResult(null);
    setSelectedAnswers({});

    if (initialTopic.length > 0) {
      void loadQuiz(initialTopic, referenceText);
    } else {
      setStep("setup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFileUpload = async (file: File) => {
    setUploadError("");
    if (file.size === 0) {
      setUploadError("Tệp bạn chọn đang bị rỗng.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Tệp tài liệu vượt quá giới hạn 10 MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const textExts = new Set(["txt", "md", "csv", "json", "tex"]);
    const baseNameTopic = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim();

    if (textExts.has(ext)) {
      try {
        const text = (await file.text()).trim().slice(0, 9500);
        if (!text) {
          setUploadError("Tệp văn bản không có nội dung chữ.");
          return;
        }
        setReferenceText(text);
        setUploadedFileName(file.name);
        if (!draftTopic.trim() && baseNameTopic) {
          setDraftTopic(baseNameTopic);
        }
      } catch {
        setUploadError("Không đọc được nội dung tệp văn bản này.");
      }
      return;
    }

    if (ext === "pdf" || ext === "docx") {
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(`${aiServiceUrl}/api/quiz/extract-file`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.extracted_text) {
          throw new Error(data.detail || "Không trích xuất được chữ từ tệp này.");
        }
        setReferenceText(data.extracted_text);
        setUploadedFileName(data.filename || file.name);
        if (!draftTopic.trim() && (data.suggested_topic || baseNameTopic)) {
          setDraftTopic(data.suggested_topic || baseNameTopic);
        }
      } catch (err: any) {
        setUploadError(
          err?.message ||
            "Không đọc được tệp PDF/DOCX lúc này. Bạn có thể dán nội dung tài liệu vào ô bên dưới."
        );
      } finally {
        setUploadingFile(false);
      }
      return;
    }

    setUploadError("Định dạng chưa hỗ trợ. Vui lòng chọn tệp .txt, .md, .docx, .pdf, .csv hoặc .json.");
  };

  const handleStartGeneratedQuiz = () => {
    const chosenTopic =
      draftTopic.trim() ||
      uploadedFileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
      "Tài liệu học tập";
    if (!draftTopic.trim() && chosenTopic) {
      setDraftTopic(chosenTopic);
    }
    onTopicChange?.(chosenTopic);
    void loadQuiz(chosenTopic, referenceText);
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (submitResult) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmit = async () => {
    if (questions.length === 0) return;
    setSubmitting(true);
    setErrorMsg("");

    const safeWallet =
      /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
        ? walletAddress
        : "0xA206B966480E6eeE2F3F96e6958899e71501B8e2";
    const sessionId = `quiz_sess_${Date.now()}`;

    // Nhánh Fallback Local Quiz
    if (fallbackMode || !quizId) {
      let correctCount = 0;
      const review: QuizReviewItem[] = [];
      const extractedCards: QuizFlashcard[] = [];

      for (const q of fallbackItems) {
        const chosen = selectedAnswers[q.id];
        const isRight = chosen === q.correct_index;
        if (isRight) correctCount += 1;
        else {
          extractedCards.push({
            tag: "Quiz Mode B • Ôn lại",
            front: q.question,
            back: `${q.options[q.correct_index]} — ${q.explanation}`,
          });
        }
        review.push({
          question_id: q.id,
          correct_index: q.correct_index,
          explanation: q.explanation,
        });
      }

      if (extractedCards.length === 0 && fallbackItems.length > 0) {
        extractedCards.push({
          tag: "Quiz Mode B • Tổng kết",
          front: fallbackItems[0].question,
          back: `${fallbackItems[0].options[fallbackItems[0].correct_index]} — ${fallbackItems[0].explanation}`,
        });
      }

      const ratio = correctCount / fallbackItems.length;
      const passed = ratio >= 0.6;
      const llmScore = Math.round(ratio * 10 * 10) / 10;
      const feynmanScore = Math.max(50, Math.min(100, Math.round(50 + llmScore * 5)));

      let demoSig: `0x${string}` | undefined;
      if (passed) {
        try {
          const demoRes = await fetch(`${gatewayUrl}/api/v1/oracle/demo-attest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentAddress: safeWallet,
              completedMinutes,
            }),
          });
          if (demoRes.ok) {
            const demoData = await demoRes.json();
            if (demoData.signature) demoSig = demoData.signature;
          }
        } catch {
          // Bỏ qua nếu gateway không bật demo-attest
        }
      }

      onAddFlashcards(extractedCards);
      setSubmitResult({
        passed,
        score: llmScore,
        correct: correctCount,
        total: fallbackItems.length,
        feedback: passed
          ? `Xuất sắc! Bạn trả lời đúng ${correctCount}/${fallbackItems.length} câu (${Math.round(ratio * 100)}%).`
          : `Bạn đúng ${correctCount}/${fallbackItems.length} câu (< 60%). Hãy xem giải thích bên dưới và thử lại.`,
        review,
        flashcards: extractedCards,
        proofSignature: demoSig,
        proofScore: feynmanScore,
        proofMinutes: completedMinutes,
      });
      setSubmitting(false);
      return;
    }

    // Nhánh gọi thật POST /api/quiz/submit
    try {
      const answersPayload = questions.map((q) => ({
        question_id: q.id,
        selected_index: selectedAnswers[q.id] ?? 0,
      }));

      const res = await fetch(`${aiServiceUrl}/api/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quizId,
          session_id: sessionId,
          wallet_address: safeWallet,
          minutes_studied: completedMinutes,
          answers: answersPayload,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Lỗi chấm bài (${res.status})`);
      }

      const data = await res.json();
      const mappedCards: QuizFlashcard[] = (data.flashcards || []).map((fc: any) => ({
        tag: "Quiz Mode B • AI",
        front: fc.question,
        back: fc.answer,
      }));

      if (mappedCards.length > 0) {
        onAddFlashcards(mappedCards);
      }

      const llmScore = Number(data.score ?? 0);
      const oracleScore =
        data.proof?.feynmanScore ??
        Math.max(50, Math.min(100, Math.round(50 + llmScore * 5)));

      setSubmitResult({
        passed: Boolean(data.passed),
        score: llmScore,
        correct: Number(data.correct ?? 0),
        total: Number(data.total ?? questions.length),
        feedback: data.feedback || "",
        review: data.review || [],
        flashcards: mappedCards,
        proofSignature: data.proof?.signature,
        proofScore: oracleScore,
        proofMinutes: data.proof?.completedMinutes ?? completedMinutes,
        oracleMock: Boolean(data.proof?.mock),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể nộp bài quiz. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToClaim = () => {
    if (!submitResult) return;
    onCompleteToResult({
      passed: submitResult.passed,
      actualMinutes,
      completedMinutes: submitResult.proofMinutes ?? completedMinutes,
      feynmanScore: submitResult.proofScore ?? 85,
      llmScore: submitResult.score,
      signature: submitResult.proofSignature,
      aiFeedback: submitResult.feedback,
      flashcards: submitResult.flashcards,
      mode: "quiz",
      oracleMock: submitResult.oracleMock,
    });
  };

  const answeredCount = questions.filter((q) => selectedAnswers[q.id] !== undefined).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const progressPct =
    questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const displayTopic =
    draftTopic.trim() || topic.trim() || uploadedFileName || "Tài liệu học tập";
  const canGenerateQuiz =
    draftTopic.trim().length > 0 || referenceText.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl ${
          darkMode
            ? "bg-slate-950 border-slate-800 text-white"
            : "bg-[#FCFBF7] border-[#E5DFD3] text-[#2D2620]"
        }`}
      >
        <DialogHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold">
              <BrainCircuit className="w-6 h-6 text-[#6E8E72]" />
              {step === "setup"
                ? "Thiết lập chủ đề & tài liệu Quiz AI"
                : "Kiểm tra nhanh AI Quiz (Chế độ B)"}
            </DialogTitle>

            {step === "quiz" && (
              <button
                type="button"
                onClick={() => setStep("setup")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                  darkMode
                    ? "border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
                    : "border-[#E5DFD3] bg-[#F5F2EA] hover:bg-[#ECE7DA] text-[#3E362E]"
                }`}
              >
                📎 Đổi chủ đề / Tải tài liệu
              </button>
            )}
          </div>
          <DialogDescription
            className={`text-sm ${darkMode ? "text-slate-400" : "text-[#7A7167]"}`}
          >
            {step === "setup" ? (
              "Bạn chưa nhập chủ đề ở màn hình chính — hãy gõ tên môn học, tải tệp tài liệu (.txt, .md, .docx, .pdf) hoặc dán ghi chú ôn tập để AI tạo đúng 5 câu hỏi sát nội dung vừa học."
            ) : (
              <>
                Chủ đề:{" "}
                <strong className={darkMode ? "text-white" : "text-[#2D2620]"}>
                  {displayTopic}
                </strong>{" "}
                • Đạt từ 60% trở lên (≥ 3/5 câu) để nhận chữ ký Oracle.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* BƯỚC 0: NHẬP CHỦ ĐỀ / UPLOAD TÀI LIỆU */}
        {step === "setup" && (
          <div className="space-y-5 my-2">
            <div className="space-y-2">
              <label className="block text-sm font-bold">
                1. Chủ đề hoặc tên môn học
              </label>
              <input
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
                placeholder="Ví dụ: Giải tích 1, Cấu trúc dữ liệu Cây nhị phân, Kinh tế lượng..."
                className={`w-full h-12 px-4 rounded-2xl border-2 text-base sm:text-lg font-bold placeholder:font-normal placeholder:text-sm focus:outline-none focus:border-[#6E8E72] ${
                  darkMode
                    ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                    : "bg-white border-[#E0D9CA] text-[#2D2620] placeholder:text-[#9A9084]"
                }`}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold">
                2. Tải lên tài liệu ôn tập (.txt, .md, .docx, .pdf) — Tùy chọn
              </label>

              <label
                className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                  darkMode
                    ? "border-slate-700 bg-slate-900/60 hover:border-[#6E8E72]"
                    : "border-[#D8D0C1] bg-[#F5F2EA] hover:border-[#6E8E72]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6E8E72]/15 text-[#6E8E72] flex items-center justify-center shrink-0">
                    {uploadingFile ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">
                      {uploadingFile
                        ? "Đang trích xuất văn bản từ tài liệu..."
                        : "Chọn tệp từ máy tính để AI ra đề theo đúng tài liệu"}
                    </div>
                    <div className="text-xs opacity-70">
                      Hỗ trợ .txt, .md, .docx, .pdf, .csv, .json (tối đa 10 MB)
                    </div>
                  </div>
                </div>
                <span className="px-4 py-2 rounded-full bg-[#6E8E72] text-white text-xs font-semibold shrink-0">
                  Chọn tệp
                </span>
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx,.csv,.json,.tex"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>

              {uploadedFileName && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{uploadedFileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFileName("");
                      setReferenceText("");
                    }}
                    className="hover:text-rose-500 cursor-pointer"
                    title="Gỡ tài liệu"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="text-xs px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/35 text-rose-600 dark:text-rose-300">
                  {uploadError}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold opacity-85">
                  3. Nội dung tài liệu / Ghi chú ôn tập (có thể dán trực tiếp tại đây)
                </label>
                <span className="opacity-65 font-mono">
                  {referenceText.length}/9500 ký tự
                </span>
              </div>
              <textarea
                rows={5}
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value.slice(0, 9500))}
                placeholder="Văn bản trích xuất từ tệp (hoặc ghi chú bạn dán vào) sẽ hiển thị ở đây để AI đặt 5 câu hỏi sát nội dung..."
                className={`w-full p-4 rounded-2xl border-2 text-sm leading-relaxed focus:outline-none focus:border-[#6E8E72] ${
                  darkMode
                    ? "bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
                    : "bg-white border-[#E0D9CA] text-[#2D2620] placeholder:text-[#9A9084]"
                }`}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-black/10 dark:border-white/10">
              <Button variant="outline" onClick={onClose} className="rounded-full px-5">
                Đóng
              </Button>
              <Button
                disabled={!canGenerateQuiz || uploadingFile}
                onClick={handleStartGeneratedQuiz}
                className="bg-[#6E8E72] hover:bg-[#5d7a61] text-white rounded-full px-7 py-5 text-sm font-semibold gap-2"
              >
                <Sparkles className="w-4 h-4" /> Tạo 5 câu hỏi Quiz bằng AI
              </Button>
            </div>
          </div>
        )}

        {/* Thanh tiến trình & Số thứ tự câu hỏi */}
        {step === "quiz" && questions.length > 0 && (
          <div
            className={`p-4 rounded-2xl border space-y-2.5 ${
              darkMode
                ? "bg-slate-900/70 border-slate-800"
                : "bg-[#F5F2EA] border-[#E5DFD3]"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>
                Tiến độ làm bài: {answeredCount}/{questions.length} câu ({progressPct}%)
              </span>
              <div className="flex items-center gap-1.5">
                {questions.map((q, idx) => {
                  const chosen = selectedAnswers[q.id];
                  const rev = submitResult?.review.find((r) => r.question_id === q.id);
                  const pillCls = rev
                    ? chosen === rev.correct_index
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-rose-500 text-white border-rose-500"
                    : chosen !== undefined
                      ? "bg-[#6E8E72] text-white border-[#6E8E72]"
                      : darkMode
                        ? "bg-slate-950 text-slate-400 border-slate-700"
                        : "bg-white text-[#7A7167] border-[#E5DFD3]";
                  return (
                    <span
                      key={q.id}
                      className={`w-6 h-6 rounded-full border text-[11px] font-bold flex items-center justify-center transition-colors ${pillCls}`}
                    >
                      {idx + 1}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-[#6E8E72] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {step !== "setup" && errorMsg && (
          <div className="text-xs px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300">
            {errorMsg}
          </div>
        )}

        {step === "loading" && (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-base">
            <Loader2 className="w-8 h-8 animate-spin text-[#6E8E72]" />
            <span>AI đang biên soạn 5 câu hỏi trắc nghiệm theo chủ đề & tài liệu của bạn...</span>
          </div>
        )}

        {step === "quiz" && (
          <div className="space-y-5 my-2">
            {submitResult && (
              <div
                className={`p-5 rounded-2xl border space-y-2 ${
                  submitResult.passed
                    ? "bg-emerald-500/10 border-emerald-500/40"
                    : "bg-rose-500/10 border-rose-500/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-base flex items-center gap-2">
                    {submitResult.passed ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ĐẠT CHUẨN QUIZ ({submitResult.correct}/{submitResult.total} câu — {submitResult.score}/10)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-500" />
                        CHƯA ĐẠT ({submitResult.correct}/{submitResult.total} câu — cần ≥ 60%)
                      </>
                    )}
                  </span>
                  {submitResult.flashcards.length > 0 && (
                    <span className="text-xs px-3 py-1 rounded-full bg-[#6E8E72]/20 text-[#6E8E72] font-semibold flex items-center gap-1.5">
                      <BookMarked className="w-3.5 h-3.5" /> +{submitResult.flashcards.length} Flashcard đã lưu
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-90">{submitResult.feedback}</p>
                {submitResult.passed && !submitResult.proofSignature && (
                  <div className="text-xs px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Bài Quiz này chạy ở chế độ Offline dự phòng nên chưa có chữ ký Oracle on-chain. Hãy bấm &ldquo;Tạo bộ câu hỏi mới&rdquo; hoặc kiểm tra AI Service để nhận Proof rút cọc.
                    </span>
                  </div>
                )}
              </div>
            )}

            {questions.map((q, qIndex) => {
              const chosenIdx = selectedAnswers[q.id];
              const reviewItem = submitResult?.review.find((r) => r.question_id === q.id);

              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-2xl border space-y-3.5 ${
                    darkMode
                      ? "bg-slate-900/70 border-slate-800"
                      : "bg-[#F5F2EA] border-[#E5DFD3]"
                  }`}
                >
                  <div className="text-base sm:text-lg font-bold leading-relaxed">
                    Câu {qIndex + 1}: {q.question}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = chosenIdx === optIdx;
                      const isCorrect = reviewItem && reviewItem.correct_index === optIdx;
                      const isWrongChosen =
                        reviewItem && isSelected && reviewItem.correct_index !== optIdx;

                      let btnStyle = darkMode
                        ? "bg-slate-950 border-slate-800 hover:border-slate-500 text-slate-200"
                        : "bg-white border-[#E5DFD3] hover:border-[#6E8E72] text-[#2D2620]";

                      let letterStyle = darkMode
                        ? "bg-slate-800 text-slate-300"
                        : "bg-[#F3EFE6] text-[#5C5349]";

                      if (reviewItem) {
                        if (isCorrect) {
                          btnStyle =
                            "bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold";
                          letterStyle = "bg-emerald-500 text-white";
                        } else if (isWrongChosen) {
                          btnStyle =
                            "bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300";
                          letterStyle = "bg-rose-500 text-white";
                        }
                      } else if (isSelected) {
                        btnStyle =
                          "bg-[#6E8E72]/15 border-[#6E8E72] text-[#2D2620] dark:text-white font-semibold shadow-xs";
                        letterStyle = "bg-[#6E8E72] text-white";
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={Boolean(submitResult)}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`text-left text-sm leading-relaxed p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${btnStyle}`}
                        >
                          <span
                            className={`w-7 h-7 rounded-full shrink-0 text-xs font-bold flex items-center justify-center mt-0.5 ${letterStyle}`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {reviewItem && (
                    <div className="text-xs pt-1 opacity-85 italic leading-relaxed">
                      💡 Giải thích: {reviewItem.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === "quiz" && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-black/10 dark:border-white/10">
            <span className="text-sm font-medium opacity-75">
              Đã chọn: {answeredCount}/{questions.length} câu
            </span>

            <div className="flex flex-wrap items-center gap-2.5">
              {!submitResult ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!allAnswered || submitting}
                  className="bg-[#6E8E72] hover:bg-[#5d7a61] text-white rounded-full px-7 py-5 text-sm font-semibold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Đang chấm điểm...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5" /> Nộp bài & Chấm điểm
                    </>
                  )}
                </Button>
              ) : submitResult.passed ? (
                <>
                  {!submitResult.proofSignature && (
                    <Button
                      variant="outline"
                      onClick={() => void loadQuiz()}
                      className="rounded-full px-5 py-5 text-xs font-semibold gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Tạo lại Quiz Online (lấy Proof)
                    </Button>
                  )}
                  <Button
                    onClick={handleProceedToClaim}
                    className="bg-[#E84142] hover:bg-[#c93233] text-white rounded-full px-7 py-5 text-sm font-semibold gap-1.5"
                  >
                    Tiếp tục nhận Proof & Claim thưởng <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => void loadQuiz()}
                  className="bg-[#6E8E72] hover:bg-[#5d7a61] text-white rounded-full px-7 py-5 text-sm font-semibold gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" /> Tạo bộ câu hỏi mới & Làm lại
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
