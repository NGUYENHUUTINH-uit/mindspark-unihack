"""
services/quiz.py — Logic thuần Python cho quiz (không gọi API).

Chức năng:
  shuffle_options(questions) → xáo thứ tự lựa chọn, cập nhật correct_index
  grade(quiz_data, answers)   → chấm điểm, trả kết quả chi tiết
  build_flashcards(...)       → tạo flashcard từ câu sai (tối đa 3), hoặc 1 thẻ tổng hợp
"""
import random
import uuid
from typing import Optional

from app.schemas import AnswerItem


def shuffle_options(questions: list[dict]) -> list[dict]:
    """
    Xáo ngẫu nhiên thứ tự 4 lựa chọn của từng câu hỏi.
    Cập nhật correct_index theo vị trí mới của đáp án đúng.

    Args:
        questions: Danh sách câu hỏi từ LLM (mỗi phần tử có options, correct_index).

    Returns:
        Danh sách câu hỏi mới với options đã xáo và correct_index đã cập nhật.
    """
    result = []
    for q in questions:
        options = list(q["options"])
        correct_answer = options[q["correct_index"]]  # Lưu đáp án đúng trước khi xáo

        # Xáo thứ tự lựa chọn ngẫu nhiên
        random.shuffle(options)

        # Tìm vị trí mới của đáp án đúng sau khi xáo
        new_correct_index = options.index(correct_answer)

        result.append({
            **q,
            "options": options,
            "correct_index": new_correct_index,
        })
    return result


def grade(
    quiz_data: list[dict],
    answers: list[AnswerItem],
) -> dict:
    """
    Chấm bài bằng code (không gọi LLM).

    Args:
        quiz_data: Danh sách câu hỏi đầy đủ (từ session_store, có correct_index & explanation).
        answers:   Danh sách đáp án client gửi lên.

    Returns:
        dict với các key:
          - total: int — tổng số câu
          - correct: int — số câu đúng
          - wrong_items: list[dict] — các câu sai (kèm correct_index, explanation)
          - all_items: list[dict] — toàn bộ câu kèm kết quả (cho review)
    """
    # Tạo dict để tra cứu nhanh theo question_id
    answer_map: dict[str, int] = {a.question_id: a.selected_index for a in answers}

    total = len(quiz_data)
    correct_count = 0
    wrong_items = []
    all_items = []

    for q in quiz_data:
        qid = q["id"]
        selected = answer_map.get(qid, -1)  # -1 nếu không trả lời câu này
        is_correct = (selected == q["correct_index"])

        if is_correct:
            correct_count += 1
        else:
            wrong_items.append({
                "id": qid,
                "question": q["question"],
                "options": q["options"],
                "selected_index": selected,
                "correct_index": q["correct_index"],
                "explanation": q.get("explanation", ""),
            })

        all_items.append({
            "id": qid,
            "question": q["question"],
            "correct_index": q["correct_index"],
            "explanation": q.get("explanation", ""),
            "is_correct": is_correct,
        })

    return {
        "total": total,
        "correct": correct_count,
        "wrong_items": wrong_items,
        "all_items": all_items,
    }


def build_flashcards(
    wrong_items: list[dict],
    topic: Optional[str] = None,
) -> list[dict]:
    """
    Sinh flashcard từ các câu sai (tối đa 3 thẻ).
    Nếu đúng hết (wrong_items=[]) → trả 1 thẻ tổng hợp từ topic.

    Returns:
        list[dict] với keys: question, answer
    """
    if not wrong_items:
        # Đúng hết: 1 thẻ tổng hợp
        return [{
            "question": f"Bạn đã trả lời đúng tất cả câu hỏi về chủ đề: {topic or 'bài học này'}. Hãy tóm tắt lại điểm chính là gì?",
            "answer": "Ôn lại transcript/tài liệu để củng cố kiến thức dài hạn.",
        }]

    # Lấy tối đa 3 câu sai đầu tiên
    cards = []
    for item in wrong_items[:3]:
        correct_option = item["options"][item["correct_index"]]
        explanation = item.get("explanation", "")
        cards.append({
            "question": item["question"],
            "answer": f"{correct_option}" + (f" — {explanation}" if explanation else ""),
        })
    return cards

