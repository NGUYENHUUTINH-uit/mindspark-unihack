"""
tests/test_quiz_grading.py — Unit tests cho logic chấm quiz (không cần API key).

Chạy: pytest tests/test_quiz_grading.py -v
"""
import os
import sys

# Cho phép import từ app/ khi chạy pytest từ thư mục ai-service/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Đặt biến môi trường giả để pydantic-settings không báo lỗi thiếu key
os.environ.setdefault("GROQ_API_KEY", "test_dummy")
os.environ.setdefault("GEMINI_API_KEY", "test_dummy")

import pytest
from app.schemas import AnswerItem
from app.services import quiz as quiz_service
from app.services import session_store


# ---------------------------------------------------------------------------
# Fixture: bộ câu hỏi mẫu (5 câu, đáp án tại index 0)
# ---------------------------------------------------------------------------
@pytest.fixture()
def sample_questions() -> list[dict]:
    return [
        {
            "id": f"q{i+1}",
            "question": f"Câu hỏi số {i+1}?",
            "options": ["Đúng", "Sai A", "Sai B", "Sai C"],
            "correct_index": 0,
            "explanation": f"Vì đáp án {i+1} là Đúng.",
        }
        for i in range(5)
    ]


@pytest.fixture(autouse=True)
def reset_store():
    """Reset session store trước mỗi test để tránh side effects."""
    session_store._reset_all()
    yield
    session_store._reset_all()


# ---------------------------------------------------------------------------
# Test chấm điểm
# ---------------------------------------------------------------------------

def test_grade_all_correct(sample_questions):
    """Trả lời đúng hết 5/5 → correct=5, ratio=1.0."""
    answers = [AnswerItem(question_id=f"q{i+1}", selected_index=0) for i in range(5)]
    result = quiz_service.grade(quiz_data=sample_questions, answers=answers)
    assert result["total"] == 5
    assert result["correct"] == 5
    assert result["wrong_items"] == []


def test_grade_all_wrong(sample_questions):
    """Trả lời sai hết → correct=0."""
    answers = [AnswerItem(question_id=f"q{i+1}", selected_index=1) for i in range(5)]
    result = quiz_service.grade(quiz_data=sample_questions, answers=answers)
    assert result["correct"] == 0
    assert len(result["wrong_items"]) == 5


def test_grade_three_correct(sample_questions):
    """Trả lời đúng 3/5 → correct=3, passed khi ratio >= 0.6."""
    answers = [
        AnswerItem(question_id="q1", selected_index=0),  # đúng
        AnswerItem(question_id="q2", selected_index=0),  # đúng
        AnswerItem(question_id="q3", selected_index=0),  # đúng
        AnswerItem(question_id="q4", selected_index=1),  # sai
        AnswerItem(question_id="q5", selected_index=1),  # sai
    ]
    result = quiz_service.grade(quiz_data=sample_questions, answers=answers)
    assert result["correct"] == 3
    ratio = result["correct"] / result["total"]
    assert ratio >= 0.6  # đạt


def test_grade_two_correct_not_passed(sample_questions):
    """Trả lời đúng 2/5 → ratio=0.4 < 0.6 → không đạt."""
    answers = [
        AnswerItem(question_id="q1", selected_index=0),  # đúng
        AnswerItem(question_id="q2", selected_index=0),  # đúng
        AnswerItem(question_id="q3", selected_index=1),  # sai
        AnswerItem(question_id="q4", selected_index=1),  # sai
        AnswerItem(question_id="q5", selected_index=1),  # sai
    ]
    result = quiz_service.grade(quiz_data=sample_questions, answers=answers)
    ratio = result["correct"] / result["total"]
    assert ratio < 0.6  # không đạt


# ---------------------------------------------------------------------------
# Test session store — dùng lại quiz_id
# ---------------------------------------------------------------------------

def test_submit_quiz_twice_raises_404(sample_questions):
    """Nộp bài lần 2 cùng quiz_id phải không tìm thấy (đã xóa sau lần 1)."""
    quiz_id = session_store.create_quiz(sample_questions)

    # Lần 1: lấy và xóa
    data = session_store.get_quiz(quiz_id)
    assert data is not None
    session_store.delete_quiz(quiz_id)

    # Lần 2: không còn trong store
    data2 = session_store.get_quiz(quiz_id)
    assert data2 is None


def test_quiz_ttl_expired(sample_questions, monkeypatch):
    """Quiz hết TTL (giả lập bằng monkeypatch time.monotonic) → get_quiz trả None."""
    import time
    quiz_id = session_store.create_quiz(sample_questions)

    # Giả lập thời gian tiến lên 31 phút
    original_monotonic = time.monotonic
    monkeypatch.setattr(
        "app.services.session_store.time.monotonic",
        lambda: original_monotonic() + 31 * 60,
    )

    result = session_store.get_quiz(quiz_id)
    assert result is None, "Quiz đã hết TTL phải trả None"


# ---------------------------------------------------------------------------
# Test proof tracking — session chỉ nhận 1 proof
# ---------------------------------------------------------------------------

def test_session_proof_409():
    """session_id đã được mark_proof → has_proof trả True."""
    sid = "session-abc-123"
    assert not session_store.has_proof(sid)
    session_store.mark_proof(sid)
    assert session_store.has_proof(sid)


def test_different_session_no_proof():
    """session_id khác nhau độc lập với nhau."""
    session_store.mark_proof("session-A")
    assert not session_store.has_proof("session-B")


# ---------------------------------------------------------------------------
# Test xáo lựa chọn
# ---------------------------------------------------------------------------

def test_shuffle_preserves_correct_answer(sample_questions):
    """Sau khi shuffle, đáp án đúng vẫn trỏ đến cùng nội dung."""
    shuffled = quiz_service.shuffle_options(sample_questions)
    for original, shuf in zip(sample_questions, shuffled):
        correct_content_before = original["options"][original["correct_index"]]
        correct_content_after = shuf["options"][shuf["correct_index"]]
        assert correct_content_before == correct_content_after, (
            f"Nội dung đáp án đúng thay đổi sau shuffle: {correct_content_before!r} → {correct_content_after!r}"
        )


# ---------------------------------------------------------------------------
# Test flashcards
# ---------------------------------------------------------------------------

def test_flashcard_all_correct_returns_one_summary():
    """Đúng hết → 1 thẻ tổng hợp."""
    cards = quiz_service.build_flashcards(wrong_items=[], topic="Giải tích")
    assert len(cards) == 1
    assert "Giải tích" in cards[0]["question"]


def test_flashcard_wrong_items_max_3():
    """Có 5 câu sai → tối đa 3 thẻ flashcard."""
    wrong = [
        {
            "id": f"q{i}",
            "question": f"Câu {i}?",
            "options": ["A", "B", "C", "D"],
            "correct_index": 0,
            "explanation": "Vì A đúng.",
        }
        for i in range(5)
    ]
    cards = quiz_service.build_flashcards(wrong_items=wrong)
    assert len(cards) == 3

