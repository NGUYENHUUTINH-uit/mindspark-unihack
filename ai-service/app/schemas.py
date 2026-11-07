"""
schemas.py — Toàn bộ Pydantic v2 schemas dùng chung cho ai-service.
Tách riêng để routers và services đều import từ đây, tránh circular import.
"""
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Regex kiểm tra địa chỉ ví Ethereum (không dùng thư viện web3)
# ---------------------------------------------------------------------------
_WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def validate_wallet(addr: str) -> str:
    """Raise ValueError nếu địa chỉ ví không hợp lệ."""
    if not _WALLET_RE.match(addr):
        raise ValueError(f"Địa chỉ ví không hợp lệ: {addr!r}. Phải là 0x + 40 ký tự hex.")
    return addr


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class FlashCard(BaseModel):
    """Một thẻ flashcard Q&A để ôn lại kiến thức."""
    question: str
    answer: str


class ProofData(BaseModel):
    """
    Payload proof từ Oracle service (hoặc mock).
    Gắn vào response khi sinh viên đạt điểm chuẩn.
    """
    success: bool
    studentAddress: str
    completedMinutes: int
    feynmanScore: int       # Thang 50-100 (đã quy đổi từ thang 1-10 của LLM)
    nonce: str
    messageHash: str
    signature: str
    vaultAddress: str
    chainId: str
    mock: bool = False      # True nếu đang dùng ORACLE_MOCK=true


# ---------------------------------------------------------------------------
# Mode A: Feynman Voice
# ---------------------------------------------------------------------------

class FeynmanEvaluateResponse(BaseModel):
    """
    Response của POST /api/feynman/evaluate.
    proof=None nếu không đạt hoặc oracle lỗi (kèm HTTP 502).
    """
    passed: bool
    score: float = Field(..., ge=0, le=10, description="Điểm LLM thang 1-10")
    feedback: str
    transcript: str         # Trả về để Frontend có thể hiển thị
    flashcards: list[FlashCard]
    proof: Optional[ProofData] = None


# ---------------------------------------------------------------------------
# Mode B: Quiz — Generate
# ---------------------------------------------------------------------------

class QuizGenerateRequest(BaseModel):
    session_id: str
    wallet_address: str
    topic: str = Field(..., min_length=1, max_length=500)
    reference_text: Optional[str] = Field(default=None, max_length=10000)
    num_questions: int = Field(default=5, ge=1, le=10)

    @field_validator("wallet_address", mode="before")
    @classmethod
    def _check_wallet(cls, v: str) -> str:
        return validate_wallet(v)


class QuizQuestion(BaseModel):
    """Một câu hỏi trắc nghiệm trả về cho client (KHÔNG có đáp án)."""
    id: str
    question: str
    options: list[str] = Field(..., min_length=4, max_length=4)


class QuizGenerateResponse(BaseModel):
    quiz_id: str
    questions: list[QuizQuestion]


# ---------------------------------------------------------------------------
# Mode B: Quiz — Submit
# ---------------------------------------------------------------------------

class AnswerItem(BaseModel):
    question_id: str
    selected_index: int = Field(..., ge=0, le=3)


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    session_id: str
    wallet_address: str
    minutes_studied: int = Field(..., ge=1)
    answers: list[AnswerItem]

    @field_validator("wallet_address", mode="before")
    @classmethod
    def _check_wallet(cls, v: str) -> str:
        return validate_wallet(v)


class ReviewItem(BaseModel):
    """Chi tiết đáp án cho từng câu sau khi nộp bài."""
    question_id: str
    correct_index: int
    explanation: str


class QuizSubmitResponse(BaseModel):
    passed: bool
    score: float = Field(..., ge=0, le=10, description="Điểm thang 1-10 (quy đổi từ % đúng)")
    correct: int
    total: int
    feedback: str
    flashcards: list[FlashCard]
    review: list[ReviewItem]
    proof: Optional[ProofData] = None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

