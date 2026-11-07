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

from fastapi import HTTPException
from groq import AsyncGroq, RateLimitError
from groq import APIStatusError as GroqAPIStatusError

from app.config import get_settings

logger = logging.getLogger("mindspark.stt")

# Backoff giữa các lần retry (giây)
_RETRY_BACKOFF = [1.0, 2.0]


async def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Chuyển audio bytes → chuỗi transcript (tự detect ngôn ngữ Việt/Anh).

    Args:
        audio_bytes: Nội dung file audio đọc vào RAM.
        filename: Tên file gốc (dùng để Groq nhận diện định dạng qua extension).

    Returns:
        Chuỗi transcript đã strip whitespace.

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
            )
            return transcript
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
) -> str:
    """
    Implementation thật dùng Groq Whisper.
    Để đổi sang OpenAI Whisper: thay hàm này, giữ nguyên interface transcribe().

    Groq nhận file dưới dạng tuple (filename, bytes, content_type) qua multipart.
    """
    client = AsyncGroq(api_key=api_key)

    # Xác định content_type từ extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    content_type_map = {
        "webm": "audio/webm",
        "wav":  "audio/wav",
        "mp3":  "audio/mpeg",
        "m4a":  "audio/mp4",
        "ogg":  "audio/ogg",
    }
    content_type = content_type_map.get(ext, "audio/webm")

    t0 = time.perf_counter()
    response = await client.audio.transcriptions.create(
        model=model,
        file=(filename, audio_bytes, content_type),
        # Không chỉ định language → Whisper tự detect (hỗ trợ Việt và Anh)
        response_format="text",
    )
    elapsed = (time.perf_counter() - t0) * 1000
    logger.debug("Groq Whisper hoàn thành trong %.0f ms (model=%s)", elapsed, model)

    # response là str khi response_format="text"
    return str(response).strip()

