"""
tests/test_quiz_api.py — Unit tests cho các endpoints Quiz:
  - POST /api/quiz/generate
  - POST /api/quiz/submit

Chạy: pytest tests/test_quiz_api.py -v
"""
import os
import sys
import time
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

# Cho phép import app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("GROQ_API_KEY", "test_groq_key")
os.environ.setdefault("GEMINI_API_KEY", "test_gemini_key")
os.environ.setdefault("ORACLE_MOCK", "true")

from app.main import app
from app.services import session_store


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_store():
    session_store._reset_all()
    yield
    session_store._reset_all()


VALID_WALLET = "0x71C84517C37400E01f37500A405A429b62F34008"


@pytest.fixture
def mock_raw_quiz():
    """Mock danh sách câu hỏi trả về từ LLM (5 câu)."""
    return [
        {
            "id": f"q{i+1}",
            "question": f"Câu hỏi số {i+1} về thuật toán Dijkstra là gì?",
            "options": ["Đáp án đúng", "Lựa chọn sai A", "Lựa chọn sai B", "Lựa chọn sai C"],
            "correct_index": 0,
            "explanation": f"Giải thích cho câu {i+1}: Đáp án đúng là chính xác.",
        }
        for i in range(5)
    ]


# ---------------------------------------------------------------------------
# Test POST /api/quiz/generate
# ---------------------------------------------------------------------------

def test_generate_quiz_success(client, mock_raw_quiz):
    """Sinh quiz thành công: trả 5 câu hỏi, không lộ đáp án hay explanation."""
    with patch("app.routers.quiz.llm_service.generate_quiz", AsyncMock(return_value=mock_raw_quiz)):
        response = client.post(
            "/api/quiz/generate",
            json={
                "session_id": "session-quiz-01",
                "wallet_address": VALID_WALLET,
                "topic": "Thuật toán Dijkstra",
                "num_questions": 5,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "quiz_id" in data
        assert len(data["questions"]) == 5

        # Đảm bảo không để lộ đáp án cho client
        for q in data["questions"]:
            assert "id" in q
            assert "question" in q
            assert "options" in q
            assert len(q["options"]) == 4
            assert "correct_index" not in q
            assert "explanation" not in q

        # Kiểm tra quiz đã được lưu trong store
        stored = session_store.get_quiz(data["quiz_id"])
        assert stored is not None
        assert len(stored) == 5


def test_generate_quiz_invalid_wallet_raises_422(client):
    """Địa chỉ ví không đúng định dạng -> trả 422."""
    response = client.post(
        "/api/quiz/generate",
        json={
            "session_id": "session-bad-wallet",
            "wallet_address": "not-a-valid-wallet",
            "topic": "Cấu trúc dữ liệu",
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Test POST /api/quiz/submit
# ---------------------------------------------------------------------------

def test_submit_quiz_all_correct(client, mock_raw_quiz):
    """Đúng 5/5 (100%) -> passed=True, score=10.0, 1 thẻ flashcard tổng hợp, có proof."""
    with patch("app.routers.quiz.llm_service.generate_quiz", AsyncMock(return_value=mock_raw_quiz)):
        gen_res = client.post(
            "/api/quiz/generate",
            json={
                "session_id": "session-all-correct",
                "wallet_address": VALID_WALLET,
                "topic": "Thuật toán Dijkstra",
                "num_questions": 5,
            },
        )
        quiz_id = gen_res.json()["quiz_id"]

    # Đọc quiz trong store để tìm vị trí đáp án đúng sau khi xáo
    stored_quiz = session_store.get_quiz(quiz_id)
    answers = [
        {"question_id": q["id"], "selected_index": q["correct_index"]}
        for q in stored_quiz
    ]

    sub_res = client.post(
        "/api/quiz/submit",
        json={
            "quiz_id": quiz_id,
            "session_id": "session-all-correct",
            "wallet_address": VALID_WALLET,
            "minutes_studied": 45,
            "answers": answers,
        },
    )

    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["passed"] is True
    assert data["correct"] == 5
    assert data["total"] == 5
    assert data["score"] == 10.0
    assert len(data["flashcards"]) == 1
    assert "Dijkstra" in data["flashcards"][0]["question"]
    assert len(data["review"]) == 5
    assert data["proof"] is not None
    assert data["proof"]["studentAddress"].lower() == VALID_WALLET.lower()
    assert data["proof"]["feynmanScore"] == 100  # 50 + 10.0 * 5 = 100


def test_submit_quiz_pass_threshold_3_of_5(client, mock_raw_quiz):
    """Đúng 3/5 (60%) -> passed=True, score=6.0, 2 flashcard từ câu sai, có proof."""
    with patch("app.routers.quiz.llm_service.generate_quiz", AsyncMock(return_value=mock_raw_quiz)):
        gen_res = client.post(
            "/api/quiz/generate",
            json={
                "session_id": "session-pass-threshold",
                "wallet_address": VALID_WALLET,
                "topic": "Thuật toán Dijkstra",
                "num_questions": 5,
            },
        )
        quiz_id = gen_res.json()["quiz_id"]

    stored_quiz = session_store.get_quiz(quiz_id)
    # Chọn đúng 3 câu đầu, sai 2 câu sau
    answers = [
        {"question_id": stored_quiz[0]["id"], "selected_index": stored_quiz[0]["correct_index"]},
        {"question_id": stored_quiz[1]["id"], "selected_index": stored_quiz[1]["correct_index"]},
        {"question_id": stored_quiz[2]["id"], "selected_index": stored_quiz[2]["correct_index"]},
        {"question_id": stored_quiz[3]["id"], "selected_index": (stored_quiz[3]["correct_index"] + 1) % 4},
        {"question_id": stored_quiz[4]["id"], "selected_index": (stored_quiz[4]["correct_index"] + 1) % 4},
    ]

    sub_res = client.post(
        "/api/quiz/submit",
        json={
            "quiz_id": quiz_id,
            "session_id": "session-pass-threshold",
            "wallet_address": VALID_WALLET,
            "minutes_studied": 30,
            "answers": answers,
        },
    )

    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["passed"] is True
    assert data["correct"] == 3
    assert data["total"] == 5
    assert data["score"] == 6.0
    assert len(data["flashcards"]) == 2  # 2 câu sai -> 2 flashcard
    assert data["proof"] is not None
    assert data["proof"]["feynmanScore"] == 80  # 50 + 6.0 * 5 = 80


def test_submit_quiz_fail_2_of_5(client, mock_raw_quiz):
    """Đúng 2/5 (40%) -> passed=False, score=4.0, 3 flashcard từ câu sai, proof=None."""
    with patch("app.routers.quiz.llm_service.generate_quiz", AsyncMock(return_value=mock_raw_quiz)):
        gen_res = client.post(
            "/api/quiz/generate",
            json={
                "session_id": "session-fail",
                "wallet_address": VALID_WALLET,
                "topic": "Thuật toán Dijkstra",
                "num_questions": 5,
            },
        )
        quiz_id = gen_res.json()["quiz_id"]

    stored_quiz = session_store.get_quiz(quiz_id)
    # Đúng 2 câu, sai 3 câu
    answers = [
        {"question_id": stored_quiz[0]["id"], "selected_index": stored_quiz[0]["correct_index"]},
        {"question_id": stored_quiz[1]["id"], "selected_index": stored_quiz[1]["correct_index"]},
        {"question_id": stored_quiz[2]["id"], "selected_index": (stored_quiz[2]["correct_index"] + 1) % 4},
        {"question_id": stored_quiz[3]["id"], "selected_index": (stored_quiz[3]["correct_index"] + 1) % 4},
        {"question_id": stored_quiz[4]["id"], "selected_index": (stored_quiz[4]["correct_index"] + 1) % 4},
    ]

    sub_res = client.post(
        "/api/quiz/submit",
        json={
            "quiz_id": quiz_id,
            "session_id": "session-fail",
            "wallet_address": VALID_WALLET,
            "minutes_studied": 30,
            "answers": answers,
        },
    )

    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["passed"] is False
    assert data["correct"] == 2
    assert data["total"] == 5
    assert data["score"] == 4.0
    assert len(data["flashcards"]) == 3  # Tối đa 3 flashcard
    assert data["proof"] is None


def test_submit_quiz_single_use_raises_404(client, mock_raw_quiz):
    """Nộp lại cùng quiz_id lần 2 -> trả 404 (dùng một lần)."""
    with patch("app.routers.quiz.llm_service.generate_quiz", AsyncMock(return_value=mock_raw_quiz)):
        gen_res = client.post(
            "/api/quiz/generate",
            json={
                "session_id": "session-single-use",
                "wallet_address": VALID_WALLET,
                "topic": "Đồ thị",
                "num_questions": 5,
            },
        )
        quiz_id = gen_res.json()["quiz_id"]

    stored_quiz = session_store.get_quiz(quiz_id)
    answers = [{"question_id": q["id"], "selected_index": 0} for q in stored_quiz]

    # Nộp lần 1: OK
    res1 = client.post(
        "/api/quiz/submit",
        json={
            "quiz_id": quiz_id,
            "session_id": "session-single-use",
            "wallet_address": VALID_WALLET,
            "minutes_studied": 30,
            "answers": answers,
        },
    )
    assert res1.status_code == 200

    # Nộp lần 2: phải 404 vì quiz_id đã bị xóa
    res2 = client.post(
        "/api/quiz/submit",
        json={
            "quiz_id": quiz_id,
            "session_id": "session-single-use",
            "wallet_address": VALID_WALLET,
            "minutes_studied": 30,
            "answers": answers,
        },
    )
    assert res2.status_code == 404
    assert "không tồn tại hoặc đã hết hạn" in res2.json()["detail"]


def test_submit_quiz_expired_raises_404(client, mock_raw_quiz, monkeypatch):
    """Quiz hết TTL (> 30 phút) -> nộp bài trả 404."""
    with patch("app.routers.quiz.llm_service.generate_quiz", AsyncMock(return_value=mock_raw_quiz)):
        gen_res = client.post(
            "/api/quiz/generate",
            json={
                "session_id": "session-expired",
                "wallet_address": VALID_WALLET,
                "topic": "Hệ điều hành",
                "num_questions": 5,
            },
        )
        quiz_id = gen_res.json()["quiz_id"]

    # Giả lập thời gian trôi qua 31 phút
    orig_monotonic = time.monotonic
    monkeypatch.setattr(
        "app.services.session_store.time.monotonic",
        lambda: orig_monotonic() + 31 * 60,
    )

    res = client.post(
        "/api/quiz/submit",
        json={
            "quiz_id": quiz_id,
            "session_id": "session-expired",
            "wallet_address": VALID_WALLET,
            "minutes_studied": 30,
            "answers": [],
        },
    )
    assert res.status_code == 404
    assert "hết hạn" in res.json()["detail"]


def test_submit_quiz_duplicate_session_proof_raises_409(client, mock_raw_quiz):
    """session_id đã nhận proof trước đó -> nộp bài quiz khác với cùng session_id phải trả 409."""
    session_store.mark_proof("session-already-has-proof")

    # Tạo quiz mới
    quiz_id = session_store.create_quiz(mock_raw_quiz, topic="Topic A")

    res = client.post(
        "/api/quiz/submit",
        json={
            "quiz_id": quiz_id,
            "session_id": "session-already-has-proof",
            "wallet_address": VALID_WALLET,
            "minutes_studied": 30,
            "answers": [{"question_id": "q1", "selected_index": 0}],
        },
    )
    assert res.status_code == 409
    assert "đã nhận proof" in res.json()["detail"]
