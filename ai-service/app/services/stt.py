"""
services/stt.py — Speech-To-Text (Whisper qua Groq API).

Interface:
  transcribe(audio_bytes, filename) → str

Groq Whisper được dùng mặc định. Interface được thiết kế để dễ đổi sang
OpenAI Whisper bằng cách thay implementation của _transcribe_groq().

Retry: tối đa 2 lần với backoff 1s/2s nếu gặp 429 / lỗi tạm thời.
Lỗi sau retry → HTTPException 503 với thông báo tiếng Việt.
"""
import asyncio
import logging
import time

import httpx
from fastapi import HTTPException
from groq import (
    APIConnectionError,
    APIStatusError as GroqAPIStatusError,
    APITimeoutError,
    AsyncGroq,
    RateLimitError,
)

from app.config import get_settings

logger = logging.getLogger("mindspark.stt")

# Backoff giữa các lần retry (giây)
_RETRY_BACKOFF = [1.0, 2.0]

# Các câu hallucination phổ biến của Whisper khi nhận audio im lặng / nhiễu nền
_SILENCE_HALLUCINATIONS = {
    "thank you",
    "thanks for watching",
    "you",
    "bye",
    "subtitles by the amara org community",
    "cảm ơn các bạn đã theo dõi",
    "hẹn gặp lại các bạn trong những video tiếp theo",
}

_SILENCE_SUBSTRINGS = (
    "đăng kí cho kênh",
    "đăng ký kênh",
    "để không bỏ lỡ những video hấp dẫn",
    "ghiền mì gõ",
    "lalaschool",
)


def _clean_whisper_transcript(raw: str) -> str:
    """Chuẩn hóa transcript và loại bỏ ảo giác phổ biến khi file audio chỉ có im lặng."""
    text = raw.strip()
    normalized = text.lower().strip(" .,!?;:\"'()[]{}-…")
    if normalized in _SILENCE_HALLUCINATIONS:
        return ""
    if any(marker in normalized for marker in _SILENCE_SUBSTRINGS):
        return ""
    return text


async def transcribe(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    prompt: str | None = None,
) -> str:
    """
    Chuyển audio bytes → chuỗi transcript (tự detect ngôn ngữ Việt/Anh).

    Args:
        audio_bytes: Nội dung file audio đọc vào RAM.
        filename: Tên file gốc (dùng để Groq nhận diện định dạng qua extension).
        prompt: Ngữ cảnh chủ đề giúp Whisper nhận diện thuật ngữ chính xác hơn.

    Returns:
        Chuỗi transcript đã strip whitespace (trả về "" nếu chỉ là ảo giác im lặng).

    Raises:
        HTTPException 503 nếu Groq không phản hồi sau 2 lần retry.
    """
    settings = get_settings()

    for attempt in range(3):  # 1 lần chính + 2 lần retry
        try:
            transcript = await _transcribe_groq(
                audio_bytes=audio_bytes,
                filename=filename,
                model=settings.stt_model,
                api_key=settings.groq_api_key,
                prompt=prompt,
            )
            return _clean_whisper_transcript(transcript)
        except RateLimitError:
            # 429 — đợi rồi thử lại
            if attempt < 2:
                wait = _RETRY_BACKOFF[attempt]
                logger.warning("Groq STT 429 (rate limit). Retry %d/2 sau %.1fs.", attempt + 1, wait)
                await asyncio.sleep(wait)
            else:
                logger.error("Groq STT vẫn 429 sau 2 lần retry.")
                raise HTTPException(
                    status_code=503,
                    detail="Dịch vụ nhận dạng giọng nói đang quá tải. Vui lòng thử lại sau vài giây.",
                )
        except GroqAPIStatusError as exc:
            # Các lỗi HTTP khác từ Groq (5xx tạm thời)
            if exc.status_code and exc.status_code >= 500 and attempt < 2:
                wait = _RETRY_BACKOFF[attempt]
                logger.warning("Groq STT lỗi %d. Retry %d/2 sau %.1fs.", exc.status_code, attempt + 1, wait)
                await asyncio.sleep(wait)
            else:
                # Không log message lỗi đầy đủ để tránh lộ thông tin nhạy cảm
                logger.error("Groq STT lỗi sau retry: status=%s", getattr(exc, "status_code", "?"))
                raise HTTPException(
                    status_code=503,
                    detail="Dịch vụ nhận dạng giọng nói gặp lỗi. Vui lòng thử lại sau.",
                )
        except (APIConnectionError, APITimeoutError) as exc:
            # Lỗi mạng / timeout kết nối tới Groq
            if attempt < 2:
                wait = _RETRY_BACKOFF[attempt]
                logger.warning("Groq STT timeout / lỗi kết nối (%s). Retry %d/2 sau %.1fs.", type(exc).__name__, attempt + 1, wait)
                await asyncio.sleep(wait)
            else:
                logger.error("Groq STT lỗi kết nối sau 2 lần retry.")
                raise HTTPException(
                    status_code=503,
                    detail="Không thể kết nối tới dịch vụ nhận dạng giọng nói. Vui lòng kiểm tra kết nối mạng và thử lại.",
                )
        except Exception as exc:
            logger.error("Lỗi không xác định khi gọi STT: %s", type(exc).__name__)
            raise HTTPException(
                status_code=503,
                detail="Dịch vụ nhận dạng giọng nói gặp lỗi. Vui lòng thử lại sau.",
            )

    # Không bao giờ đến đây (loop luôn raise hoặc return)
    raise HTTPException(status_code=503, detail="STT thất bại.")


async def _transcribe_groq(
    audio_bytes: bytes,
    filename: str,
    model: str,
    api_key: str,
    prompt: str | None = None,
) -> str:
    """
    Implementation thật dùng Groq Whisper.
    Để đổi sang OpenAI Whisper: thay hàm này, giữ nguyên interface transcribe().

    Groq nhận file dưới dạng tuple (filename, bytes, content_type) qua multipart.
    """
    # Cấu hình timeout thoải mái cho cả write/upload trên mạng chậm
    timeout = httpx.Timeout(60.0, connect=15.0, read=60.0, write=60.0)
    client = AsyncGroq(api_key=api_key, timeout=timeout)

    # Xác định content_type từ extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    content_type_map = {
        "webm": "audio/webm",
        "wav":  "audio/wav",
        "mp3":  "audio/mpeg",
        "m4a":  "audio/mp4",
        "mp4":  "audio/mp4",
        "ogg":  "audio/ogg",
    }
    content_type = content_type_map.get(ext, "audio/webm")

    create_kwargs: dict = {
        "model": model,
        "file": (filename, audio_bytes, content_type),
        # Không chỉ định language → Whisper tự detect (hỗ trợ Việt và Anh)
        "response_format": "text",
    }
    if prompt and prompt.strip():
        create_kwargs["prompt"] = prompt.strip()[:220]

    t0 = time.perf_counter()
    response = await client.audio.transcriptions.create(**create_kwargs)
    elapsed = (time.perf_counter() - t0) * 1000
    logger.debug("Groq Whisper hoàn thành trong %.0f ms (model=%s)", elapsed, model)

    # response là str khi response_format="text"
    return str(response).strip()

