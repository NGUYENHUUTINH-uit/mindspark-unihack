"""
services/oracle_client.py — Giao tiếp với Oracle Service của team Blockchain.

Luồng:
  1. Nếu ORACLE_MOCK=true → trả proof giả (đánh dấu mock=True) để dev độc lập.
  2. Nếu không → gọi POST {ORACLE_SERVICE_URL}/api/v1/oracle/attest với header x-oracle-auth.
  3. Oracle lỗi / không chạy → raise HTTPException 502 với thông báo tiếng Việt.

Quy đổi điểm: LLM chấm thang 1-10, oracle nhận thang 50-100.
  Công thức (thực hiện ở router): feynman_score_oracle = max(50, min(100, round(50 + score * 5)))
"""
import logging

import httpx
from fastapi import HTTPException

from app.config import get_settings
from app.schemas import ProofData

logger = logging.getLogger("mindspark.oracle_client")


async def request_proof(
    student_address: str,
    completed_minutes: int,
    feynman_score: int,         # Thang 50-100 (đã quy đổi từ router)
) -> ProofData:
    """
    Gọi Oracle service để lấy chữ ký EIP-191, trả về ProofData.

    Raises:
        HTTPException 502 nếu oracle không phản hồi hoặc trả lỗi.
    """
    settings = get_settings()

    # ------------------------------------------------------------------
    # Mock mode: trả proof giả để dev không cần oracle thật
    # ------------------------------------------------------------------
    if settings.oracle_mock:
        logger.warning("ORACLE_MOCK=true — trả proof giả cho session này.")
        return ProofData(
            success=True,
            studentAddress=student_address,
            completedMinutes=completed_minutes,
            feynmanScore=feynman_score,
            nonce="0",
            messageHash="0x" + "00" * 32,
            signature="0x" + "00" * 65,
            vaultAddress="0x" + "00" * 20,
            chainId="43113",
            mock=True,
        )

    # ------------------------------------------------------------------
    # Gọi oracle thật
    # ------------------------------------------------------------------
    url = f"{settings.oracle_service_url}/api/v1/oracle/attest"
    payload = {
        "studentAddress": student_address,
        "completedMinutes": completed_minutes,
        "feynmanScore": feynman_score,
    }
    headers = {
        "x-oracle-auth": settings.oracle_api_key,
        "Content-Type": "application/json",
    }

    logger.info(
        "Gọi Oracle: url=%s | student=%s | minutes=%d | score=%d",
        url, student_address, completed_minutes, feynman_score,
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.ConnectError:
        logger.error("Không thể kết nối tới Oracle service tại %s", url)
        raise HTTPException(
            status_code=502,
            detail="Không thể kết nối tới Oracle service. Hãy đảm bảo oracle đang chạy và ORACLE_SERVICE_URL đúng.",
        )
    except httpx.TimeoutException:
        logger.error("Oracle service timeout sau 10s")
        raise HTTPException(
            status_code=502,
            detail="Oracle service không phản hồi (timeout 10 giây). Vui lòng thử lại.",
        )
    except httpx.RequestError as exc:
        logger.error("Lỗi khi gọi Oracle: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Lỗi kết nối tới Oracle service. Vui lòng thử lại sau.",
        )

    # ------------------------------------------------------------------
    # Xử lý response từ oracle
    # ------------------------------------------------------------------
    if resp.status_code == 401:
        # Lỗi xác thực — không để lộ secret trong log
        logger.error("Oracle từ chối xác thực (401). Kiểm tra ORACLE_API_KEY.")
        raise HTTPException(
            status_code=502,
            detail="Oracle service từ chối xác thực. Liên hệ team Blockchain để kiểm tra ORACLE_API_KEY.",
        )

    if resp.status_code != 200:
        # Cố lấy thông báo lỗi từ oracle nhưng không để lộ nội dung nhạy cảm
        try:
            oracle_err = resp.json().get("error", "Lỗi không xác định")
        except Exception:
            oracle_err = resp.text[:200]  # Giới hạn độ dài log
        logger.error("Oracle trả HTTP %d: %s", resp.status_code, oracle_err)
        raise HTTPException(
            status_code=502,
            detail=f"Oracle service trả lỗi: {oracle_err}",
        )

    try:
        data = resp.json()
    except Exception:
        logger.error("Oracle trả response không phải JSON hợp lệ")
        raise HTTPException(
            status_code=502,
            detail="Oracle service trả dữ liệu không hợp lệ. Vui lòng thử lại.",
        )

    # Validate response từ oracle bằng Pydantic
    try:
        proof = ProofData(**data, mock=False)
    except Exception as exc:
        logger.error("Không parse được ProofData từ oracle response: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Oracle trả dữ liệu không đúng định dạng. Vui lòng thử lại.",
        )

    logger.info("Oracle cấp proof thành công | student=%s | nonce=%s", student_address, proof.nonce)
    return proof

