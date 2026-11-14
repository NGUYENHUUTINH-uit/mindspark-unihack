"""
tests/test_oracle_client.py — Unit tests cho oracle_client.py.
Kiểm tra cả chế độ Mock (ORACLE_MOCK=true) và chế độ gọi Oracle thật (mocked HTTP).

Chạy: pytest tests/test_oracle_client.py -v
"""
import os
import sys
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException

# Cho phép import app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("GROQ_API_KEY", "test_groq_key")
os.environ.setdefault("GEMINI_API_KEY", "test_gemini_key")

from app.config import get_settings
from app.services import oracle_client


STUDENT_ADDR = "0x71C84517C37400E01f37500A405A429b62F34008"


@pytest.mark.asyncio
async def test_oracle_client_mock_mode(monkeypatch):
    """Khi ORACLE_MOCK=true -> trả proof giả lập có mock=True."""
    settings = get_settings()
    monkeypatch.setattr(settings, "oracle_mock", True)

    proof = await oracle_client.request_proof(
        student_address=STUDENT_ADDR,
        completed_minutes=45,
        feynman_score=85,
    )

    assert proof.mock is True
    assert proof.studentAddress == STUDENT_ADDR
    assert proof.completedMinutes == 45
    assert proof.feynmanScore == 85
    assert proof.chainId == "43113"
    assert proof.nonce == "0"


@pytest.mark.asyncio
async def test_oracle_client_real_success(monkeypatch):
    """Khi gọi Oracle thật thành công (200 OK) -> parse đúng ProofData thật."""
    settings = get_settings()
    monkeypatch.setattr(settings, "oracle_mock", False)

    mock_oracle_response = {
        "success": True,
        "studentAddress": STUDENT_ADDR,
        "completedMinutes": 60,
        "feynmanScore": 90,
        "nonce": "1",
        "messageHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "signature": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678901c",
        "vaultAddress": "0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223",
        "chainId": "43113",
    }

    mock_resp = httpx.Response(200, json=mock_oracle_response)
    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_resp)):
        proof = await oracle_client.request_proof(
            student_address=STUDENT_ADDR,
            completed_minutes=60,
            feynman_score=90,
        )

        assert proof.mock is False
        assert proof.signature == mock_oracle_response["signature"]
        assert proof.nonce == "1"
        assert proof.vaultAddress == mock_oracle_response["vaultAddress"]


@pytest.mark.asyncio
async def test_oracle_client_connection_error_raises_502(monkeypatch):
    """Oracle server không bật / không kết nối được -> trả HTTP 502 rõ ràng."""
    settings = get_settings()
    monkeypatch.setattr(settings, "oracle_mock", False)

    with patch("httpx.AsyncClient.post", AsyncMock(side_effect=httpx.ConnectError("Connection refused"))):
        with pytest.raises(HTTPException) as exc_info:
            await oracle_client.request_proof(
                student_address=STUDENT_ADDR,
                completed_minutes=60,
                feynman_score=90,
            )
        assert exc_info.value.status_code == 502
        assert "Không thể kết nối" in exc_info.value.detail


@pytest.mark.asyncio
async def test_oracle_client_unauthorized_401_raises_502(monkeypatch):
    """Oracle từ chối API secret (401) -> trả HTTP 502 kèm thông báo bảo mật."""
    settings = get_settings()
    monkeypatch.setattr(settings, "oracle_mock", False)

    mock_resp = httpx.Response(401, json={"success": False, "error": "Unauthorized"})
    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_resp)):
        with pytest.raises(HTTPException) as exc_info:
            await oracle_client.request_proof(
                student_address=STUDENT_ADDR,
                completed_minutes=60,
                feynman_score=90,
            )
        assert exc_info.value.status_code == 502
        assert "từ chối xác thực" in exc_info.value.detail


@pytest.mark.asyncio
async def test_oracle_client_error_response_raises_502(monkeypatch):
    """Oracle trả lỗi nghiệp vụ (ví dụ: phiên học đã hết hạn) -> trả 502 kèm nguyên nhân."""
    settings = get_settings()
    monkeypatch.setattr(settings, "oracle_mock", False)

    mock_resp = httpx.Response(400, json={"success": False, "error": "Study session has expired past the deadline!"})
    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_resp)):
        with pytest.raises(HTTPException) as exc_info:
            await oracle_client.request_proof(
                student_address=STUDENT_ADDR,
                completed_minutes=60,
                feynman_score=90,
            )
        assert exc_info.value.status_code == 502
        assert "Study session has expired" in exc_info.value.detail
