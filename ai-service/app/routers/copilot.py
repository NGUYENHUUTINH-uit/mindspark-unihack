"""
routers/copilot.py — POST /api/copilot/ask

Chỉ API Gateway (sau khi đã xác minh vi thanh toán x402 on-chain) được gọi endpoint này,
xác thực bằng header x-oracle-auth (shared secret server-to-server).
"""
import hmac

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schemas import FlashCard
from app.services import llm as llm_service

router = APIRouter()


class CopilotAskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)


class CopilotAskResponse(BaseModel):
    topic: str
    answer: str
    flashcard: FlashCard


@router.post("/ask", response_model=CopilotAskResponse)
async def ask_copilot(
    req: CopilotAskRequest,
    x_oracle_auth: str | None = Header(default=None),
):
    settings = get_settings()
    if not x_oracle_auth or not hmac.compare_digest(x_oracle_auth, settings.oracle_api_key):
        raise HTTPException(status_code=401, detail="Unauthorized")

    result = await llm_service.answer_copilot(req.question)
    return CopilotAskResponse(
        topic=result["topic"],
        answer=result["answer"],
        flashcard=FlashCard(**result["flashcard"]),
    )
