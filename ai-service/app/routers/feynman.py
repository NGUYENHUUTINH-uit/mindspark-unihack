"""
routers/feynman.py — Endpoint POST /api/feynman/evaluate (Chế độ A: Nói).

Luồng xử lý:
  1. Validate multipart fields (ví, duration, dung lượng audio)
  2. STT: Groq Whisper → transcript
  3. LLM: Gemini chấm điểm Feynman
  4. Nếu đạt → gọi Oracle → lấy proof
  5. Trả FeynmanEvaluateResponse
"""
import logging
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas import (
    FeynmanEvaluateResponse,
    FeynmanTextEvaluateRequest,
    FlashCard,
    ProofData,
    TranscribeResponse,
    validate_wallet,
)
from app.services import llm as llm_service
from app.services import oracle_client
from app.services import session_store
from app.services import stt as stt_service

logger = logging.getLogger("mindspark.feynman")

router = APIRouter()

# Dung lượng tối đa audio: 5 MB
_MAX_AUDIO_BYTES = 5 * 1024 * 1024


async def _evaluate_and_attest(
    transcript: str,
    topic: str,
    wallet_address: str,
    session_id: str,
    minutes_studied: int,
    reference_text: str | None,
) -> FeynmanEvaluateResponse:
    """Chấm điểm Feynman từ transcript và gọi Oracle ký proof nếu đạt chuẩn."""
    t_llm = time.perf_counter()
    eval_result = await llm_service.evaluate_feynman(
        transcript=transcript,
        topic=topic,
        reference_text=reference_text,
    )
    logger.info("LLM chấm điểm hoàn thành trong %.0f ms", (time.perf_counter() - t_llm) * 1000)

    word_count = len(transcript.split())
    passed = (
        word_count >= 15
        and not eval_result.is_gibberish
        and eval_result.score >= 5
    )

    logger.info(
        "session=%s | words=%d | score=%.1f | gibberish=%s | passed=%s",
        session_id, word_count, eval_result.score, eval_result.is_gibberish, passed,
    )

    proof: ProofData | None = None
    if passed:
        t_oracle = time.perf_counter()
        # Công thức: 50 + score * 5  (score=5 → 75, score=10 → 100)
        feynman_score_oracle = max(50, min(100, round(50 + eval_result.score * 5)))

        proof = await oracle_client.request_proof(
            student_address=wallet_address,
            completed_minutes=minutes_studied,
            feynman_score=feynman_score_oracle,
        )
        logger.info("Oracle trả proof trong %.0f ms", (time.perf_counter() - t_oracle) * 1000)
        session_store.mark_proof(session_id)

    return FeynmanEvaluateResponse(
        passed=passed,
        score=eval_result.score,
        feedback=eval_result.feedback,
        transcript=transcript,
        flashcards=[FlashCard(**fc) for fc in eval_result.flashcards],
        proof=proof,
    )


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_feynman_audio(
    audio: UploadFile = File(..., description="File âm thanh (webm/wav/mp3/m4a, ≤ 5MB)"),
    topic: str | None = Form(default=None),
):
    """Bước 1 của Feynman Voice: nhận audio vào RAM và trả bản chép transcript để người học kiểm tra lại."""
    t_start = time.perf_counter()
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="File audio rỗng.")
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File audio vượt quá 5 MB ({len(audio_bytes) / 1024 / 1024:.1f} MB).",
        )

    prompt_ctx = f"Chủ đề học tập: {topic.strip()}." if topic and topic.strip() else None
    transcript = await stt_service.transcribe(
        audio_bytes,
        filename=audio.filename or "audio.webm",
        prompt=prompt_ctx,
    )
    elapsed_ms = round((time.perf_counter() - t_start) * 1000)
    word_count = len(transcript.split())
    return TranscribeResponse(
        transcript=transcript,
        word_count=word_count,
        duration_ms=elapsed_ms,
        likely_silence=(word_count == 0),
    )


@router.post("/evaluate-text", response_model=FeynmanEvaluateResponse)
async def evaluate_feynman_text(req: FeynmanTextEvaluateRequest):
    """Bước 2 của Feynman Voice: chấm điểm bản transcript đã xem/chỉnh sửa và cấp Oracle proof."""
    t_start = time.perf_counter()
    if session_store.has_proof(req.session_id):
        raise HTTPException(
            status_code=409,
            detail=f"Session '{req.session_id}' đã nhận proof rồi. Mỗi phiên chỉ được cấp 1 proof.",
        )

    clean_transcript = req.transcript.strip()
    if not clean_transcript:
        raise HTTPException(status_code=422, detail="Transcript không được để trống.")

    response = await _evaluate_and_attest(
        transcript=clean_transcript,
        topic=req.topic,
        wallet_address=req.wallet_address,
        session_id=req.session_id,
        minutes_studied=req.minutes_studied,
        reference_text=req.reference_text,
    )
    logger.info("Tổng thời gian /evaluate-text: %.0f ms", (time.perf_counter() - t_start) * 1000)
    return response


@router.post("/evaluate", response_model=FeynmanEvaluateResponse)
async def evaluate_feynman(
    # --- Multipart fields ---
    audio: UploadFile = File(..., description="File âm thanh (webm/wav/mp3, ≤ 5MB)"),
    wallet_address: str = Form(...),
    session_id: str = Form(...),
    minutes_studied: int = Form(..., ge=1),
    topic: str = Form(..., min_length=1, max_length=500),
    duration_seconds: int = Form(..., ge=5, le=90, description="Độ dài audio (giây), do Frontend đo"),
    reference_text: str | None = Form(default=None),
):
    """
    Nhận audio Feynman, chấm điểm bằng LLM, cấp proof nếu đạt.

    - audio chỉ xử lý trong RAM, KHÔNG ghi ra đĩa.
    - Điều kiện đạt: transcript >= 15 từ, is_gibberish=False, score >= 5.
    - Mỗi session_id chỉ nhận tối đa 1 proof (409 nếu đã có).
    """
    t_start = time.perf_counter()

    # 1. Validate địa chỉ ví
    try:
        wallet_address = validate_wallet(wallet_address)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # 2. Kiểm tra session chưa có proof
    if session_store.has_proof(session_id):
        raise HTTPException(
            status_code=409,
            detail=f"Session '{session_id}' đã nhận proof rồi. Mỗi phiên chỉ được cấp 1 proof.",
        )

    # 3. Đọc audio vào RAM và kiểm tra dung lượng
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="File audio rỗng.")
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File audio vượt quá 5 MB ({len(audio_bytes) / 1024 / 1024:.1f} MB).",
        )

    # 4. STT: Whisper → transcript
    t_stt = time.perf_counter()
    transcript = await stt_service.transcribe(
        audio_bytes,
        filename=audio.filename or "audio.webm",
        prompt=f"Chủ đề học tập: {topic}.",
    )
    logger.info("STT hoàn thành trong %.0f ms", (time.perf_counter() - t_stt) * 1000)

    # 5-7. LLM chấm điểm + Oracle attestation
    response = await _evaluate_and_attest(
        transcript=transcript,
        topic=topic,
        wallet_address=wallet_address,
        session_id=session_id,
        minutes_studied=minutes_studied,
        reference_text=reference_text,
    )

    logger.info(
        "Tổng thời gian /evaluate: %.0f ms",
        (time.perf_counter() - t_start) * 1000,
    )
    return response

