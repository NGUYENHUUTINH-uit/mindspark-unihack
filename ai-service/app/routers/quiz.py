"""
routers/quiz.py — Endpoints cho Chế độ B: Quiz trắc nghiệm.

POST /api/quiz/generate  → sinh câu hỏi, lưu đáp án phía server
POST /api/quiz/submit    → chấm bài, trả proof nếu đạt
"""
import logging
import time

from fastapi import APIRouter, HTTPException

from app.schemas import (
    AnswerItem,
    FlashCard,
    ProofData,
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizQuestion,
    QuizSubmitRequest,
    QuizSubmitResponse,
    ReviewItem,
)
from app.services import llm as llm_service
from app.services import oracle_client
from app.services import quiz as quiz_service
from app.services import session_store

logger = logging.getLogger("mindspark.quiz")

router = APIRouter()


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(req: QuizGenerateRequest):
    """
    Sinh N câu trắc nghiệm từ LLM, xáo thứ tự lựa chọn, lưu đáp án phía server.
    Client chỉ nhận câu hỏi và 4 lựa chọn, KHÔNG có đáp án hay explanation.
    """
    t_start = time.perf_counter()

    # Sinh quiz từ LLM
    t_llm = time.perf_counter()
    raw_quiz = await llm_service.generate_quiz(
        topic=req.topic,
        reference_text=req.reference_text,
        num_questions=req.num_questions,
    )
    logger.info("LLM sinh quiz trong %.0f ms", (time.perf_counter() - t_llm) * 1000)

    # Xáo thứ tự lựa chọn và cập nhật correct_index
    shuffled = quiz_service.shuffle_options(raw_quiz)

    # Lưu quiz vào session store (TTL 30 phút, dùng một lần)
    quiz_id = session_store.create_quiz(shuffled)

    # Trả câu hỏi cho client (không có đáp án)
    questions_out = [
        QuizQuestion(id=q["id"], question=q["question"], options=q["options"])
        for q in shuffled
    ]

    logger.info(
        "Quiz tạo xong trong %.0f ms | quiz_id=%s | n=%d",
        (time.perf_counter() - t_start) * 1000,
        quiz_id,
        len(questions_out),
    )

    return QuizGenerateResponse(quiz_id=quiz_id, questions=questions_out)


@router.post("/submit", response_model=QuizSubmitResponse)
async def submit_quiz(req: QuizSubmitRequest):
    """
    Chấm bài quiz bằng code (không gọi LLM).
    Đạt nếu tỉ lệ đúng >= 60%.
    Xóa quiz_id khỏi store sau khi nộp (dùng một lần).
    Mỗi session_id chỉ nhận tối đa 1 proof.
    """
    t_start = time.perf_counter()

    # ------------------------------------------------------------------
    # 1. Lấy quiz từ store (kiểm tra hết hạn & tồn tại)
    # ------------------------------------------------------------------
    quiz_data = session_store.get_quiz(req.quiz_id)
    if quiz_data is None:
        raise HTTPException(
            status_code=404,
            detail="quiz_id không tồn tại hoặc đã hết hạn (TTL 30 phút). Vui lòng tạo quiz mới.",
        )

    # ------------------------------------------------------------------
    # 2. Kiểm tra session chưa có proof
    # ------------------------------------------------------------------
    if session_store.has_proof(req.session_id):
        raise HTTPException(
            status_code=409,
            detail=f"Session '{req.session_id}' đã nhận proof rồi.",
        )

    # ------------------------------------------------------------------
    # 3. Chấm bài bằng code
    # ------------------------------------------------------------------
    result = quiz_service.grade(quiz_data=quiz_data, answers=req.answers)
    total = result["total"]
    correct = result["correct"]
    wrong_items = result["wrong_items"]   # list[dict] câu sai

    # Tỉ lệ đúng và điểm thang 10
    ratio = correct / total if total > 0 else 0
    score10 = round(ratio * 10, 1)
    passed = ratio >= 0.6

    # ------------------------------------------------------------------
    # 4. Xóa quiz khỏi store (dùng một lần)
    # ------------------------------------------------------------------
    session_store.delete_quiz(req.quiz_id)

    # ------------------------------------------------------------------
    # 5. Sinh flashcards (từ câu sai, tối đa 3; đúng hết thì 1 thẻ tổng hợp)
    # ------------------------------------------------------------------
    flashcards = quiz_service.build_flashcards(
        wrong_items=wrong_items,
        topic=quiz_data[0]["question"] if wrong_items == [] else None,
    )

    # ------------------------------------------------------------------
    # 6. Nếu đạt → gọi Oracle
    # ------------------------------------------------------------------
    proof: ProofData | None = None
    if passed:
        t_oracle = time.perf_counter()
        # Quy đổi score10 → feynmanScore [50-100]
        feynman_score_oracle = max(50, min(100, round(50 + score10 * 5)))
        proof = await oracle_client.request_proof(
            student_address=req.wallet_address,
            completed_minutes=req.minutes_studied,
            feynman_score=feynman_score_oracle,
        )
        logger.info("Oracle trả proof trong %.0f ms", (time.perf_counter() - t_oracle) * 1000)
        session_store.mark_proof(req.session_id)

    # ------------------------------------------------------------------
    # 7. Tổng hợp review (trả full đáp án sau khi nộp)
    # ------------------------------------------------------------------
    review = [
        ReviewItem(
            question_id=item["id"],
            correct_index=item["correct_index"],
            explanation=item["explanation"],
        )
        for item in result["all_items"]
    ]

    feedback = (
        f"Bạn trả lời đúng {correct}/{total} câu ({ratio*100:.0f}%). "
        + ("Xuất sắc! Hãy tiếp tục phát huy." if passed else "Chưa đạt. Ôn lại các thẻ flashcard bên dưới nhé!")
    )

    logger.info(
        "Quiz submit hoàn thành trong %.0f ms | quiz_id=%s | %d/%d passed=%s",
        (time.perf_counter() - t_start) * 1000,
        req.quiz_id, correct, total, passed,
    )

    return QuizSubmitResponse(
        passed=passed,
        score=score10,
        correct=correct,
        total=total,
        feedback=feedback,
        flashcards=[FlashCard(**fc) for fc in flashcards],
        review=review,
        proof=proof,
    )

