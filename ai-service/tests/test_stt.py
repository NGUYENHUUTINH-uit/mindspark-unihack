"""
tests/test_stt.py — Unit tests cho dịch vụ Speech-To-Text (stt.py).
Sử dụng mock hoàn toàn để không tốn API key hay quota.

Chạy: pytest tests/test_stt.py -v
"""
import os
import sys
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException
from groq import APIStatusError as GroqAPIStatusError
from groq import RateLimitError

# Cho phép import app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("GROQ_API_KEY", "test_groq_key")
os.environ.setdefault("GEMINI_API_KEY", "test_gemini_key")

from app.services import stt as stt_service


@pytest.fixture(autouse=True)
def fast_retry_backoff(monkeypatch):
    """Giảm thời gian backoff xuống 0s khi test để test chạy ngay lập tức."""
    monkeypatch.setattr(stt_service, "_RETRY_BACKOFF", [0.0, 0.0])


@pytest.mark.asyncio
async def test_transcribe_success():
    """Kiểm tra gọi STT thành công và kết quả được strip whitespace."""
    mock_transcribe = AsyncMock(return_value="  Phương pháp Feynman giúp đơn giản hóa kiến thức.  ")
    with patch.object(stt_service, "_transcribe_groq", mock_transcribe):
        result = await stt_service.transcribe(b"dummy_audio_bytes", filename="audio.wav")
        assert result == "Phương pháp Feynman giúp đơn giản hóa kiến thức."
        mock_transcribe.assert_called_once()


@pytest.mark.asyncio
async def test_transcribe_rate_limit_retry_then_success():
    """Bị 429 lần 1, retry lần 2 thành công."""
    req = httpx.Request("POST", "http://test")
    res = httpx.Response(429, request=req)
    rate_limit_err = RateLimitError("Rate limit exceeded", response=res, body=None)

    mock_transcribe = AsyncMock(side_effect=[rate_limit_err, "Đã thành công sau retry."])
    with patch.object(stt_service, "_transcribe_groq", mock_transcribe):
        result = await stt_service.transcribe(b"dummy_audio_bytes", filename="audio.webm")
        assert result == "Đã thành công sau retry."
        assert mock_transcribe.call_count == 2


@pytest.mark.asyncio
async def test_transcribe_rate_limit_exhausted_raises_503():
    """Bị 429 liên tục quá 2 lần retry -> quăng HTTPException 503."""
    req = httpx.Request("POST", "http://test")
    res = httpx.Response(429, request=req)
    rate_limit_err = RateLimitError("Rate limit exceeded", response=res, body=None)

    mock_transcribe = AsyncMock(side_effect=rate_limit_err)
    with patch.object(stt_service, "_transcribe_groq", mock_transcribe):
        with pytest.raises(HTTPException) as exc_info:
            await stt_service.transcribe(b"dummy_audio_bytes", filename="audio.mp3")
        assert exc_info.value.status_code == 503
        assert "quá tải" in exc_info.value.detail
        assert mock_transcribe.call_count == 3  # 1 lần chính + 2 lần retry


@pytest.mark.asyncio
async def test_transcribe_server_error_retry_then_success():
    """Lỗi 500 từ Groq lần 1, retry lần 2 thành công."""
    req = httpx.Request("POST", "http://test")
    res = httpx.Response(500, request=req)
    server_err = GroqAPIStatusError("Internal Server Error", response=res, body=None)

    mock_transcribe = AsyncMock(side_effect=[server_err, "Transcript thành công"])
    with patch.object(stt_service, "_transcribe_groq", mock_transcribe):
        result = await stt_service.transcribe(b"dummy_audio_bytes", filename="audio.wav")
        assert result == "Transcript thành công"
        assert mock_transcribe.call_count == 2


@pytest.mark.asyncio
async def test_transcribe_general_exception_raises_503():
    """Lỗi bất ngờ khác được wrap thành HTTPException 503, không lộ stack trace."""
    mock_transcribe = AsyncMock(side_effect=RuntimeError("Lỗi kết nối socket"))
    with patch.object(stt_service, "_transcribe_groq", mock_transcribe):
        with pytest.raises(HTTPException) as exc_info:
            await stt_service.transcribe(b"dummy_audio_bytes", filename="audio.wav")
        assert exc_info.value.status_code == 503
        assert "gặp lỗi" in exc_info.value.detail

