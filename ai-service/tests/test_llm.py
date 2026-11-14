"""
tests/test_llm.py — Unit tests cho dịch vụ LLM (evaluate_feynman).
Sử dụng mock hoàn toàn để không tốn quota hay API key.

Chạy: pytest tests/test_llm.py -v
"""
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from google.genai import errors as genai_errors

# Cho phép import app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("GROQ_API_KEY", "test_groq_key")
os.environ.setdefault("GEMINI_API_KEY", "test_gemini_key")

from app.services import llm as llm_service


@pytest.fixture(autouse=True)
def fast_retry_backoff(monkeypatch):
    """Giảm thời gian chờ retry xuống 0s để test chạy tức thì."""
    monkeypatch.setattr(llm_service, "_RETRY_BACKOFF", [0.0, 0.0])


@pytest.mark.asyncio
async def test_evaluate_feynman_good_explanation():
    """Đánh giá bài giải thích tốt: score >= 7, is_gibberish = False, có flashcard."""
    mock_response = json.dumps({
        "score": 8.5,
        "feedback": "Giải thích rất tốt về phương pháp Feynman, ngôn từ dễ hiểu.",
        "is_gibberish": False,
        "flashcards": [
            {"question": "Phương pháp Feynman là gì?", "answer": "Phương pháp học bằng cách giải thích đơn giản như dạy lại cho người khác."},
            {"question": "Bước quan trọng nhất là gì?", "answer": "Xác định lỗ hổng kiến thức khi gặp khó khăn lúc diễn giải."}
        ]
    })

    with patch.object(llm_service, "_call_gemini_with_retry", AsyncMock(return_value=mock_response)):
        result = await llm_service.evaluate_feynman(
            transcript="Phương pháp Feynman là cách học bằng cách giải thích lại một khái niệm cho người khác bằng từ ngữ đơn giản.",
            topic="Phương pháp Feynman"
        )
        assert result.score == 8.5
        assert not result.is_gibberish
        assert len(result.flashcards) == 2
        assert "Feynman" in result.feedback


@pytest.mark.asyncio
async def test_evaluate_feynman_gibberish():
    """Đánh giá bài nói nhảm/đếm số: is_gibberish = True, score thấp (<= 3)."""
    mock_response = json.dumps({
        "score": 1.5,
        "feedback": "Nội dung chỉ là đếm số vô nghĩa, hoàn toàn không liên quan đến chủ đề.",
        "is_gibberish": True,
        "flashcards": [
            {"question": "Chủ đề bài học là gì?", "answer": "Thuật toán sắp xếp nhanh (QuickSort)."}
        ]
    })

    with patch.object(llm_service, "_call_gemini_with_retry", AsyncMock(return_value=mock_response)):
        result = await llm_service.evaluate_feynman(
            transcript="Một hai ba bốn năm sáu bảy tám chín mười một hai ba bốn năm.",
            topic="Thuật toán QuickSort"
        )
        assert result.is_gibberish
        assert result.score <= 3.0


@pytest.mark.asyncio
async def test_evaluate_feynman_markdown_json_cleaning():
    """LLM trả JSON bọc trong markdown ```json ... ``` vẫn parse thành công."""
    mock_response = """```json
    {
        "score": 7.0,
        "feedback": "Hiểu được khái niệm cơ bản.",
        "is_gibberish": false,
        "flashcards": [{"question": "Q?", "answer": "A."}]
    }
    ```"""

    with patch.object(llm_service, "_call_gemini_with_retry", AsyncMock(return_value=mock_response)):
        result = await llm_service.evaluate_feynman(
            transcript="Định luật Ohm phát biểu rằng cường độ dòng điện tỉ lệ thuận với hiệu điện thế.",
            topic="Định luật Ohm"
        )
        assert result.score == 7.0
        assert not result.is_gibberish


@pytest.mark.asyncio
async def test_evaluate_feynman_json_parse_retry_success():
    """Lần 1 trả text lỗi, lần 2 trả JSON chuẩn -> thành công sau retry."""
    bad_response = "Xin lỗi, đây là nhận xét nhưng không phải định dạng JSON..."
    good_response = json.dumps({
        "score": 6.5,
        "feedback": "Đạt yêu cầu cơ bản.",
        "is_gibberish": False,
        "flashcards": [{"question": "Q?", "answer": "A."}]
    })

    with patch.object(llm_service, "_call_gemini_with_retry", AsyncMock(side_effect=[bad_response, good_response])) as mock_call:
        result = await llm_service.evaluate_feynman(
            transcript="Giải thích về biến trong lập trình là vùng nhớ lưu trữ giá trị.",
            topic="Biến trong lập trình"
        )
        assert result.score == 6.5
        assert mock_call.call_count == 2


@pytest.mark.asyncio
async def test_evaluate_feynman_json_parse_retry_exhausted_raises_502():
    """Cả 2 lần đều trả JSON hỏng -> quăng HTTPException 502."""
    bad_response = "Không thể sinh JSON..."

    with patch.object(llm_service, "_call_gemini_with_retry", AsyncMock(return_value=bad_response)):
        with pytest.raises(HTTPException) as exc_info:
            await llm_service.evaluate_feynman(
                transcript="Transcript bất kỳ...",
                topic="Chủ đề bất kỳ"
            )
        assert exc_info.value.status_code == 502
        assert "không đúng định dạng" in exc_info.value.detail


@pytest.mark.asyncio
async def test_gemini_rate_limit_retry_then_success():
    """Gemini gặp lỗi 429 lần 1, retry lần 2 thành công."""
    err_429 = genai_errors.ClientError(429, {"error": {"message": "Resource has been exhausted (e.g. check quota)."}})

    class DummyResponse:
        text = json.dumps({
            "score": 9.0,
            "feedback": "Rất tốt.",
            "is_gibberish": False,
            "flashcards": []
        })

    mock_generate = MagicMock(side_effect=[err_429, DummyResponse()])
    with patch("google.genai.Client") as mock_client_cls:
        instance = mock_client_cls.return_value
        instance.models.generate_content = mock_generate
        result = await llm_service.evaluate_feynman("Transcript test", "Topic test")
        assert result.score == 9.0
        assert mock_generate.call_count == 2


@pytest.mark.asyncio
async def test_gemini_rate_limit_exhausted_raises_503():
    """Gemini 429 liên tục quá số lần retry -> quăng 503 thân thiện."""
    err_429 = genai_errors.ClientError(429, {"error": {"message": "Rate limit 429"}})

    with patch("google.genai.Client") as mock_client_cls:
        instance = mock_client_cls.return_value
        instance.models.generate_content = MagicMock(side_effect=err_429)

        with pytest.raises(HTTPException) as exc_info:
            await llm_service.evaluate_feynman("Transcript test", "Topic test")
        assert exc_info.value.status_code == 503
        assert "quá tải" in exc_info.value.detail

