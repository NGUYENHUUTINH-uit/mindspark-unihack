"""
services/session_store.py — In-memory store cho quiz và proof tracking.

⚠️  DỮ LIỆU MẤT KHI RESTART SERVER.
Dùng Redis hoặc DB cho production.

Cấu trúc:
  _quiz_store: { quiz_id → { expires_at, questions: list[QuizEntry] } }
  _proof_store: set of session_id đã nhận proof
"""
import logging
import time
import uuid
from typing import Any, Optional

logger = logging.getLogger("mindspark.session_store")

# TTL quiz: 30 phút
_QUIZ_TTL_SECONDS = 30 * 60

# ---------------------------------------------------------------------------
# Internal state (module-level, singleton đơn giản cho hackathon)
# ---------------------------------------------------------------------------
_quiz_store: dict[str, dict[str, Any]] = {}
_proof_store: set[str] = set()


# ---------------------------------------------------------------------------
# Quiz store
# ---------------------------------------------------------------------------

def create_quiz(questions: list[dict], topic: str = "") -> str:
    """
    Lưu quiz vào store và trả về quiz_id mới.
    questions: danh sách dict đã xáo thứ tự (từ quiz_service.shuffle_options).
    topic: chủ đề học để tạo flashcard tổng kết khi đạt điểm tuyệt đối.
    """
    quiz_id = str(uuid.uuid4())
    _quiz_store[quiz_id] = {
        "expires_at": time.monotonic() + _QUIZ_TTL_SECONDS,
        "questions": questions,
        "topic": topic,
    }
    logger.debug("Quiz created: quiz_id=%s, n=%d, topic=%s", quiz_id, len(questions), topic)
    return quiz_id


def get_quiz_entry(quiz_id: str) -> Optional[dict[str, Any]]:
    """
    Trả toàn bộ dict entry (questions, topic, expires_at) nếu quiz còn hạn.
    """
    entry = _quiz_store.get(quiz_id)
    if entry is None:
        return None
    if time.monotonic() > entry["expires_at"]:
        del _quiz_store[quiz_id]
        logger.debug("Quiz expired and removed: quiz_id=%s", quiz_id)
        return None
    return entry


def get_quiz(quiz_id: str) -> Optional[list[dict]]:
    """
    Trả list questions nếu quiz còn hạn, ngược lại trả None.
    KHÔNG xóa quiz ở đây (xóa sau khi submit).
    """
    entry = get_quiz_entry(quiz_id)
    return entry["questions"] if entry else None


def delete_quiz(quiz_id: str) -> None:
    """Xóa quiz sau khi đã submit (dùng một lần)."""
    _quiz_store.pop(quiz_id, None)
    logger.debug("Quiz deleted: quiz_id=%s", quiz_id)


# ---------------------------------------------------------------------------
# Proof tracking — đảm bảo mỗi session chỉ nhận 1 proof
# ---------------------------------------------------------------------------

def has_proof(session_id: str) -> bool:
    """Trả True nếu session này đã nhận proof."""
    return session_id in _proof_store


def mark_proof(session_id: str) -> None:
    """Đánh dấu session đã nhận proof."""
    _proof_store.add(session_id)
    logger.info("Proof marked for session: %s", session_id)


# ---------------------------------------------------------------------------
# Utility (dùng trong test để reset state)
# ---------------------------------------------------------------------------

def _reset_all() -> None:
    """Chỉ dùng trong unit test để reset toàn bộ store."""
    _quiz_store.clear()
    _proof_store.clear()

