"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type StudyPose =
  | "Writing Pose"
  | "Reading Pose"
  | "Screen Focus"
  | "Thinking / Rest"
  | "Phone Distraction"
  | "Drowsy / Absent";

const PHONE_CONFIRM_FRAMES = 6; // 6 * 250ms = 1.5s cho heuristic tư thế dự phòng
const ABSENT_CONFIRM_FRAMES = 6; // 6 * 250ms = 1.5s không thấy người -> Vắng mặt
const PHONE_OBJECT_CONFIRM_TICKS = 2; // 2 nhịp ObjectDetector (~0.5-1.0s) xác nhận điện thoại

export type CameraStatus = "idle" | "active" | "error" | "blocked";

export interface UsePoseTrackerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStudying: boolean;
  showCameraPip: boolean;
  /** Ngưỡng cảnh báo cầm điện thoại (giây). Mặc định 10s cho chế độ Demo (Spec thực tế: 60s). */
  distractionThresholdSec?: number;
  /** Ngưỡng cảnh báo vắng mặt / ngủ gục (giây). Mặc định 15s cho Demo (Spec thực tế: 180s). */
  absenceThresholdSec?: number;
  /** Callback phát âm thanh cảnh báo khi vượt ngưỡng phân tâm / vắng mặt. */
  onAlertBeep?: (reason: "phone" | "absent") => void;
}

export interface UsePoseTrackerReturn {
  currentPose: StudyPose;
  focusIndex: number;
  setFocusIndex: React.Dispatch<React.SetStateAction<number>>;
  isAutoDetect: boolean;
  setIsAutoDetect: React.Dispatch<React.SetStateAction<boolean>>;
  cameraStatus: CameraStatus;
  headTiltAngle: number;
  postureConfidence: number;
  /** Trạng thái chống ảnh tĩnh / Fake Camera (MU-17). */
  isLiveSubject: boolean;
  livenessScore: number;
  blinkCount: number;
  /** Engine đang chạy thật: MediaPipe WASM hoặc Spatial Canvas Engine. */
  visionEngine: "mediapipe-wasm" | "edge-canvas";
  /** Model ObjectDetector nhận diện điện thoại & người đã sẵn sàng chưa. */
  hasPhoneDetector: boolean;
  /** Thời gian phân tâm điện thoại / vắng mặt liên tục (giây). */
  distractionSeconds: number;
  absenceSeconds: number;
  isDistractionAlert: boolean;
  isPausedByAi: boolean;
  selectManualPose: (pose: StudyPose) => void;
  resetTracker: () => void;
}

const MEDIAPIPE_CDN_BUNDLE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
const MEDIAPIPE_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const OBJECT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite";

export function usePoseTracker({
  videoRef,
  isStudying,
  showCameraPip,
  distractionThresholdSec = 10,
  absenceThresholdSec = 15,
  onAlertBeep,
}: UsePoseTrackerOptions): UsePoseTrackerReturn {
  const [currentPose, setCurrentPose] = useState<StudyPose>("Writing Pose");
  const [focusIndex, setFocusIndex] = useState<number>(98);
  const [isAutoDetect, setIsAutoDetect] = useState<boolean>(true);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [headTiltAngle, setHeadTiltAngle] = useState<number>(28);
  const [postureConfidence, setPostureConfidence] = useState<number>(97);
  const [isLiveSubject, setIsLiveSubject] = useState<boolean>(true);
  const [livenessScore, setLivenessScore] = useState<number>(96);
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [visionEngine, setVisionEngine] = useState<"mediapipe-wasm" | "edge-canvas">("edge-canvas");
  const [hasPhoneDetector, setHasPhoneDetector] = useState<boolean>(false);
  const [distractionSeconds, setDistractionSeconds] = useState<number>(0);
  const [absenceSeconds, setAbsenceSeconds] = useState<number>(0);
  const [isDistractionAlert, setIsDistractionAlert] = useState<boolean>(false);
  const [isPausedByAi, setIsPausedByAi] = useState<boolean>(false);

  // Refs tránh tạo lại interval khi state thay đổi liên tục
  const currentPoseRef = useRef<StudyPose>(currentPose);
  currentPoseRef.current = currentPose;
  const cameraStatusRef = useRef<CameraStatus>(cameraStatus);
  cameraStatusRef.current = cameraStatus;
  const onAlertBeepRef = useRef(onAlertBeep);
  onAlertBeepRef.current = onAlertBeep;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);
  const staticFramesRef = useRef<number>(0);
  const lastBlinkTsRef = useRef<number>(0);
  const wasBlinkingRef = useRef<boolean>(false);
  const absentFramesRef = useRef<number>(0);
  const phoneCandidateFramesRef = useRef<number>(0);
  const phoneObjectStreakRef = useRef<number>(0);
  const lastObjectPhoneScoreRef = useRef<number>(0);
  const lastObjectPersonRef = useRef<boolean>(true);
  const lastVideoTsRef = useRef<number>(0);
  const frameTickRef = useRef<number>(0);
  const isProcessingFrameRef = useRef<boolean>(false);
  const poseLandmarkerRef = useRef<any>(null);
  const faceLandmarkerRef = useRef<any>(null);
  const objectDetectorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectManualPose = useCallback((pose: StudyPose) => {
    setIsAutoDetect(false);
    setCurrentPose(pose);
    setIsLiveSubject(true);
    setLivenessScore(96);
    absentFramesRef.current = 0;
    phoneCandidateFramesRef.current = 0;
    phoneObjectStreakRef.current = 0;
    lastObjectPhoneScoreRef.current = 0;
    lastObjectPersonRef.current = true;
    if (pose !== "Phone Distraction" && pose !== "Drowsy / Absent") {
      setDistractionSeconds(0);
      setAbsenceSeconds(0);
      setIsDistractionAlert(false);
      setIsPausedByAi(false);
    }
  }, []);

  const resetTracker = useCallback(() => {
    setCurrentPose("Writing Pose");
    setFocusIndex(98);
    setHeadTiltAngle(28);
    setPostureConfidence(97);
    setIsLiveSubject(true);
    setLivenessScore(96);
    setBlinkCount(0);
    setDistractionSeconds(0);
    setAbsenceSeconds(0);
    setIsDistractionAlert(false);
    setIsPausedByAi(false);
    staticFramesRef.current = 0;
    absentFramesRef.current = 0;
    phoneCandidateFramesRef.current = 0;
    phoneObjectStreakRef.current = 0;
    lastObjectPhoneScoreRef.current = 0;
    lastObjectPersonRef.current = true;
  }, []);

  // 1. Nạp MediaPipe PoseLandmarker, FaceLandmarker & ObjectDetector (nhận diện điện thoại + người thật)
  useEffect(() => {
    if (!isStudying || !isAutoDetect) return;
    let cancelled = false;

    async function loadMediaPipe() {
      if (typeof window === "undefined") return;
      if (poseLandmarkerRef.current) {
        setVisionEngine("mediapipe-wasm");
        setHasPhoneDetector(Boolean(objectDetectorRef.current));
        if (objectDetectorRef.current) return;
      }

      try {
        // Dynamic import từ CDN WASM không làm nặng bundle Next.js
        const dynamicImport = new Function("u", "return import(u)");
        const vision = await dynamicImport(MEDIAPIPE_CDN_BUNDLE);
        const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);

        // Nạp ObjectDetector riêng trong try/catch để không bao giờ làm hỏng Pose/Face nếu lỗi
        if (!objectDetectorRef.current && vision.ObjectDetector) {
          vision.ObjectDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: OBJECT_MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            scoreThreshold: 0.3,
            maxResults: 5,
            categoryAllowlist: ["cell phone", "person"],
          })
            .then((objDet: any) => {
              if (!cancelled) {
                objectDetectorRef.current = objDet;
                setHasPhoneDetector(true);
              }
            })
            .catch(() => {
              if (!cancelled) setHasPhoneDetector(false);
            });
        }

        if (!poseLandmarkerRef.current) {
          const [poseLm, faceLm] = await Promise.all([
            vision.PoseLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "CPU" },
              runningMode: "VIDEO",
              numPoses: 1,
            }),
            vision.FaceLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "CPU" },
              outputFaceBlendshapes: true,
              runningMode: "VIDEO",
              numFaces: 1,
            }),
          ]);

          if (!cancelled) {
            poseLandmarkerRef.current = poseLm;
            faceLandmarkerRef.current = faceLm;
            setVisionEngine("mediapipe-wasm");
          }
        }
      } catch {
        // Fallback lặng lẽ sang Edge-Canvas Engine tích hợp sẵn khi CDN bị chặn hoặc offline
        if (!cancelled && !poseLandmarkerRef.current) {
          setVisionEngine("edge-canvas");
        }
      }
    }

    loadMediaPipe();
    return () => {
      cancelled = true;
    };
  }, [isStudying, isAutoDetect]);

  // 2. Quản lý vòng đời Webcam (100% cục bộ trên RAM)
  useEffect(() => {
    let active = true;

    if (isStudying && showCameraPip && navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("idle");
      navigator.mediaDevices
        .getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current
                ?.play()
                .then(() => setCameraStatus("active"))
                .catch(() => setCameraStatus("active"));
            };
          }
        })
        .catch(() => {
          if (active) setCameraStatus("error");
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      setCameraStatus("idle");
    }

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isStudying, showCameraPip, videoRef]);

  // 3. Vòng lặp Edge-AI Vision 4 FPS (250ms/lần, tối ưu CPU < 15%)
  useEffect(() => {
    if (!isStudying || !isAutoDetect || !showCameraPip) return;

    const interval = setInterval(() => {
      if (isProcessingFrameRef.current) return;
      const video = videoRef.current;
      if (
        !video ||
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0 ||
        cameraStatusRef.current === "error"
      ) {
        return;
      }

      isProcessingFrameRef.current = true;
      try {
        const rawNow = Math.floor(performance.now());
        const nowMs =
          rawNow > lastVideoTsRef.current ? rawNow : lastVideoTsRef.current + 1;
        lastVideoTsRef.current = nowMs;
        frameTickRef.current += 1;

        // Nhận diện vật thể thật ("cell phone" & "person") mỗi 500ms (2 FPS) để nhẹ CPU
        if (objectDetectorRef.current && frameTickRef.current % 2 === 1) {
          try {
            const objRes = objectDetectorRef.current.detectForVideo(video, nowMs);
            const detections = objRes?.detections ?? [];
            let maxPhoneScore = 0;
            let foundPerson = false;

            for (const det of detections) {
              const cats = det?.categories ?? [];
              for (const cat of cats) {
                const name = String(
                  cat?.categoryName ?? cat?.displayName ?? ""
                ).toLowerCase();
                const score = Number(cat?.score ?? 0);
                if (name === "cell phone" && score >= 0.3 && score > maxPhoneScore) {
                  maxPhoneScore = score;
                }
                if (name === "person" && score >= 0.38) {
                  foundPerson = true;
                }
              }
            }

            if (maxPhoneScore >= 0.3) {
              phoneObjectStreakRef.current = Math.min(
                6,
                phoneObjectStreakRef.current + 1
              );
              lastObjectPhoneScoreRef.current = maxPhoneScore;
            } else {
              phoneObjectStreakRef.current = Math.max(
                0,
                phoneObjectStreakRef.current - 1
              );
              if (phoneObjectStreakRef.current === 0) {
                lastObjectPhoneScoreRef.current = 0;
              }
            }
            lastObjectPersonRef.current = foundPerson;
          } catch {
            // Bỏ qua lỗi frame đơn lẻ của ObjectDetector
          }
        }

        // --- Nhánh A: Dùng MediaPipe WASM thật nếu đã nạp thành công ---
        if (poseLandmarkerRef.current) {
          try {
            const poseRes = poseLandmarkerRef.current.detectForVideo(video, nowMs);
            const lm = poseRes?.landmarks?.[0];

            // Kiểm tra Face presence & Blink Detection qua FaceLandmarker
            let hasFace = false;
            if (faceLandmarkerRef.current) {
              const faceRes = faceLandmarkerRef.current.detectForVideo(video, nowMs);
              hasFace = Boolean(
                faceRes?.faceLandmarks && faceRes.faceLandmarks.length > 0
              );
              const shapes = faceRes?.faceBlendshapes?.[0]?.categories;
              if (shapes && shapes.length > 0) {
                const blinkL =
                  shapes.find((c: any) => c.categoryName === "eyeBlinkLeft")?.score ??
                  0;
                const blinkR =
                  shapes.find((c: any) => c.categoryName === "eyeBlinkRight")
                    ?.score ?? 0;
                const isBlinkingNow = blinkL > 0.42 || blinkR > 0.42;
                if (
                  isBlinkingNow &&
                  !wasBlinkingRef.current &&
                  nowMs - lastBlinkTsRef.current > 400
                ) {
                  setBlinkCount((b) => b + 1);
                  lastBlinkTsRef.current = nowMs;
                }
                wasBlinkingRef.current = isBlinkingNow;
              }
            }

            const phoneObjectConfirmed =
              phoneObjectStreakRef.current >= PHONE_OBJECT_CONFIRM_TICKS;
            const hasStrongUpperBody = Boolean(
              lm &&
                lm.length >= 17 &&
                (lm[0]?.visibility ?? 0) > 0.65 &&
                (lm[11]?.visibility ?? 0) > 0.65 &&
                (lm[12]?.visibility ?? 0) > 0.65 &&
                lm[0].x > 0.02 &&
                lm[0].x < 0.98 &&
                lm[0].y > 0.02 &&
                lm[0].y < 0.98 &&
                Math.abs(lm[11].x - lm[12].x) > 0.14
            );

            const isHumanPresent = objectDetectorRef.current
              ? hasFace || lastObjectPersonRef.current
              : faceLandmarkerRef.current
                ? hasFace || hasStrongUpperBody
                : hasStrongUpperBody;

            if (phoneObjectConfirmed) {
              absentFramesRef.current = 0;
              setPostureConfidence(
                Math.round(
                  Math.min(99, Math.max(85, lastObjectPhoneScoreRef.current * 100))
                )
              );
              setCurrentPose("Phone Distraction");
            } else if (!isHumanPresent) {
              phoneCandidateFramesRef.current = 0;
              absentFramesRef.current += 1;
              if (absentFramesRef.current >= ABSENT_CONFIRM_FRAMES) {
                setCurrentPose("Drowsy / Absent");
                setPostureConfidence(95);
              }
            } else if (lm && lm.length >= 17) {
              absentFramesRef.current = 0;
              const nose = lm[0];
              const leftEar = lm[7];
              const rightEar = lm[8];
              const leftShoulder = lm[11];
              const rightShoulder = lm[12];
              const leftWrist = lm[15];
              const rightWrist = lm[16];

              const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
              const noseDrop = nose.y - shoulderMidY; // Càng lớn -> càng cúi đầu sâu
              const estimatedTilt = Math.round(
                Math.min(68, Math.max(10, 32 + noseDrop * 120))
              );
              setHeadTiltAngle(estimatedTilt);

              const leftVis = (leftWrist?.visibility ?? 0) > 0.45;
              const rightVis = (rightWrist?.visibility ?? 0) > 0.45;

              // Đưa 2 tay lên đầu / ôm trán / gãi đầu cao hơn trán -> Tư thế suy nghĩ/nghỉ ngơi, KHÔNG phải điện thoại
              const leftOnOrAboveHead = leftVis && leftWrist.y <= nose.y + 0.04;
              const rightOnOrAboveHead = rightVis && rightWrist.y <= nose.y + 0.04;
              const bothHandsRaised =
                leftVis &&
                rightVis &&
                leftWrist.y < shoulderMidY - 0.04 &&
                rightWrist.y < shoulderMidY - 0.04;
              const anyHandHighAboveForehead =
                (leftVis && leftWrist.y < nose.y - 0.08) ||
                (rightVis && rightWrist.y < nose.y - 0.08);
              const isThinkingOrHeadRest =
                bothHandsRaised ||
                (leftOnOrAboveHead && rightOnOrAboveHead) ||
                anyHandHighAboveForehead;

              const isHandInPhoneZone = (wrist: any, ear: any, visible: boolean) => {
                if (!visible || !ear) return false;
                const verticalBand =
                  wrist.y > nose.y - 0.04 && wrist.y < shoulderMidY + 0.06;
                const nearSideEar =
                  Math.abs(wrist.x - ear.x) < 0.16 &&
                  Math.abs(wrist.y - ear.y) < 0.18;
                const nearChinFront = Math.abs(wrist.x - nose.x) < 0.18;
                return verticalBand && (nearSideEar || nearChinFront);
              };

              const leftPhone = isHandInPhoneZone(leftWrist, leftEar, leftVis);
              const rightPhone = isHandInPhoneZone(rightWrist, rightEar, rightVis);
              const singleHandPhone = !isThinkingOrHeadRest && leftPhone !== rightPhone;

              const baseFocusPose: StudyPose =
                estimatedTilt >= 34
                  ? "Writing Pose"
                  : estimatedTilt >= 23
                    ? "Reading Pose"
                    : "Screen Focus";

              let detected: StudyPose = baseFocusPose;
              let conf = 97;

              if (isThinkingOrHeadRest) {
                phoneCandidateFramesRef.current = 0;
                detected = "Thinking / Rest";
                conf = 96;
              } else if (singleHandPhone) {
                phoneCandidateFramesRef.current += 1;
                if (phoneCandidateFramesRef.current >= PHONE_CONFIRM_FRAMES) {
                  detected = "Phone Distraction";
                  conf = 96;
                } else {
                  detected = baseFocusPose;
                  conf = 95;
                }
              } else {
                phoneCandidateFramesRef.current = 0;
                detected = baseFocusPose;
                conf = estimatedTilt >= 34 ? 98 : 97;
              }

              setPostureConfidence(conf);
              setCurrentPose(detected);
              // Kết hợp thêm kiểm tra pixel tĩnh từ canvas bên dưới
            } else {
              absentFramesRef.current = 0;
              setPostureConfidence(90);
              setCurrentPose("Screen Focus");
            }
          } catch {
            // Tiếp tục xuống fallback Canvas bên dưới nếu MediaPipe lỗi frame
          }
        }

        // --- Nhánh B: Multi-Zone Spatial & Liveness Engine trên Canvas 160x120 (RAM) ---
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
          canvasRef.current.width = 160;
          canvasRef.current.height = 120;
        }
        const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, 160, 120);
        const data = ctx.getImageData(0, 0, 160, 120).data;

        let totalBrightness = 0;
        let skinPixels = 0;
        let centerSkin = 0;
        let sumY = 0;
        let upperSkin = 0;
        let upperLeftSkin = 0;
        let upperRightSkin = 0;
        let lowerSkin = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (r + g + b) / 3;

          if (
            r > 55 &&
            g > 35 &&
            b > 20 &&
            r > g &&
            r > b &&
            Math.max(r, g, b) - Math.min(r, g, b) > 12
          ) {
            skinPixels++;
            const pxIdx = i / 4;
            const x = pxIdx % 160;
            const y = Math.floor(pxIdx / 160);
            sumY += y;
            if (x >= 30 && x <= 130 && y >= 10 && y <= 95) {
              centerSkin++;
            }
            if (y < 52) {
              upperSkin++;
              if (x < 80) upperLeftSkin++;
              else upperRightSkin++;
            }
            if (y > 68) lowerSkin++;
          }
        }

        const avgBrightness = totalBrightness / (160 * 120);
        if (avgBrightness < 12) {
          if (cameraStatusRef.current !== "blocked") setCameraStatus("blocked");
          return;
        } else if (cameraStatusRef.current === "blocked") {
          setCameraStatus("active");
        }

        // Tính biến thiên vi chuyển động + Anti-Spoofing (ảnh tĩnh bất động)
        let motion = 0;
        let upperMotion = 0;
        if (lastFrameRef.current) {
          const prev = lastFrameRef.current;
          for (let i = 0; i < data.length; i += 16) {
            const diff = Math.abs(data[i] - prev[i]);
            motion += diff;
            const y = Math.floor(i / 4 / 160);
            if (y < 60) upperMotion += diff;
          }
        }
        lastFrameRef.current = new Uint8ClampedArray(data);

        // Liveness Detection (MU-17): phát hiện ảnh tĩnh hoặc nháy mắt tự nhiên
        if (motion < 1400) {
          staticFramesRef.current += 1;
        } else {
          staticFramesRef.current = 0;
          if (
            !faceLandmarkerRef.current &&
            upperMotion > 1800 &&
            upperMotion < 9500 &&
            nowMs - lastBlinkTsRef.current > 1800
          ) {
            setBlinkCount((b) => b + 1);
            lastBlinkTsRef.current = nowMs;
          }
        }

        if (staticFramesRef.current >= 28) {
          // Bất động quá ~7s liên tiếp -> nghi ngờ ảnh tĩnh / ngủ gục
          setIsLiveSubject(false);
          setLivenessScore(38);
        } else {
          setIsLiveSubject(true);
          setLivenessScore(Math.min(99, 92 + (motion > 2000 ? 6 : 2)));
        }

        // Nếu MediaPipe WASM đã xử lý thành công tư thế, không ghi đè tư thế bằng heuristic
        if (poseLandmarkerRef.current) return;

        const canvasLikelyAbsent =
          centerSkin < 220 ||
          (staticFramesRef.current >= 16 && upperMotion < 600);
        if (canvasLikelyAbsent) {
          phoneCandidateFramesRef.current = 0;
          absentFramesRef.current += 1;
          if (absentFramesRef.current >= ABSENT_CONFIRM_FRAMES) {
            setCurrentPose("Drowsy / Absent");
            setPostureConfidence(91);
          }
          return;
        }

        absentFramesRef.current = 0;
        const centerY = sumY / Math.max(1, skinPixels);
        const tilt = Math.round(Math.min(65, Math.max(12, (centerY / 120) * 70)));
        setHeadTiltAngle(tilt);

        const bothSidesUpperRaised = upperLeftSkin > 35 && upperRightSkin > 35;
        const asymmetricUpper =
          Math.abs(upperLeftSkin - upperRightSkin) > Math.max(25, upperSkin * 0.3);
        const canvasFocusPose: StudyPose =
          centerY > 64
            ? motion < 18000
              ? "Writing Pose"
              : "Reading Pose"
            : centerY >= 36 && centerY <= 64
              ? "Screen Focus"
              : "Writing Pose";

        let newPose: StudyPose = canvasFocusPose;
        let conf = 96;

        if (bothSidesUpperRaised) {
          phoneCandidateFramesRef.current = 0;
          newPose = "Thinking / Rest";
          conf = 94;
        } else if (
          lowerSkin > skinPixels * 0.58 &&
          upperSkin > 12 &&
          asymmetricUpper &&
          motion > 35000
        ) {
          phoneCandidateFramesRef.current += 1;
          if (phoneCandidateFramesRef.current >= PHONE_CONFIRM_FRAMES) {
            newPose = "Phone Distraction";
            conf = 95;
          } else {
            newPose = canvasFocusPose;
            conf = 94;
          }
        } else {
          phoneCandidateFramesRef.current = 0;
          newPose = canvasFocusPose;
          conf = centerY > 64 ? 98 : centerY >= 36 ? 97 : 94;
        }

        setPostureConfidence(conf);
        setCurrentPose(newPose);
      } finally {
        isProcessingFrameRef.current = false;
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isStudying, isAutoDetect, showCameraPip, videoRef]);

  // 4. Đếm thời gian phân tâm / vắng mặt (mỗi 1s) → cảnh báo & tự tạm dừng Pomodoro (MU-13)
  useEffect(() => {
    if (!isStudying) return;

    const tick = setInterval(() => {
      const pose = currentPoseRef.current;

      if (pose === "Phone Distraction") {
        setAbsenceSeconds(0);
        setDistractionSeconds((prev) => {
          const next = prev + 1;
          if (next >= distractionThresholdSec) {
            setIsDistractionAlert(true);
            setIsPausedByAi(true);
            if (next === distractionThresholdSec || (next - distractionThresholdSec) % 5 === 0) {
              onAlertBeepRef.current?.("phone");
            }
          }
          return next;
        });
      } else if (pose === "Drowsy / Absent") {
        setDistractionSeconds(0);
        setAbsenceSeconds((prev) => {
          const next = prev + 1;
          if (next >= absenceThresholdSec) {
            setIsPausedByAi(true);
            if (next === absenceThresholdSec || (next - absenceThresholdSec) % 6 === 0) {
              onAlertBeepRef.current?.("absent");
            }
          }
          return next;
        });
      } else {
        setDistractionSeconds(0);
        setAbsenceSeconds(0);
        setIsDistractionAlert(false);
        setIsPausedByAi(false);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isStudying, distractionThresholdSec, absenceThresholdSec]);

  return {
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
  };
}
