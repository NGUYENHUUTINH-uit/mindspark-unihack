"""
routers/quiz.py — Endpoints cho Chế độ B: Quiz trắc nghiệm.

POST /api/quiz/generate  → sinh câu hỏi, lưu đáp án phía server
POST /api/quiz/submit    → chấm bài, trả proof nếu đạt
"""
import io
import logging
from pathlib import Path
import re
import time
import xml.etree.ElementTree as ET
import zipfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import (
    AnswerItem,
    FileExtractResponse,
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

_MAX_DOC_BYTES = 10 * 1024 * 1024
_MAX_EXTRACTED_CHARS = 9500
_TEXT_DOC_EXTS = {".txt", ".md", ".csv", ".json", ".tex"}


def _extract_docx_text(raw_bytes: bytes) -> str:
    """Trích xuất văn bản từ file .docx bằng stdlib zipfile + XML parser."""
    try:
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
            if "word/document.xml" not in zf.namelist():
                raise ValueError("Thiếu word/document.xml")
            xml_bytes = zf.read("word/document.xml")
    except (zipfile.BadZipFile, ValueError, KeyError):
        raise HTTPException(
            status_code=422,
            detail="Tệp .docx không hợp lệ hoặc bị hỏng. Vui lòng thử lại.",
        )

    root = ET.fromstring(xml_bytes)
    paragraphs: list[str] = []
    for elem in root.iter():
        if elem.tag.endswith("}p") or elem.tag == "p":
            texts = [
                sub.text
                for sub in elem.iter()
                if (sub.tag.endswith("}t") or sub.tag == "t") and sub.text
            ]
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)
    return "\n".join(paragraphs)


def _normalize_doc_text(raw: str) -> str:
    collapsed = re.sub(r"\n{3,}", "\n\n", raw).strip()
    return collapsed[:_MAX_EXTRACTED_CHARS]


@router.post("/extract-file", response_model=FileExtractResponse)
async def extract_quiz_reference_file(file: UploadFile = File(...)):
    """Đọc nội dung chữ từ tài liệu học tập (.txt, .md, .docx, .pdf, .csv, .json) để tạo Quiz AI."""
    filename = (file.filename or "tai-lieu.txt").strip()
    ext = Path(filename).suffix.lower()
    if ext not in _TEXT_DOC_EXTS and ext not in {".docx", ".pdf"}:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Định dạng '{ext or 'không rõ'}' chưa hỗ trợ. "
                "Hỗ trợ: .txt, .md, .docx, .pdf, .csv, .json"
            ),
        )

    raw_bytes = await file.read()
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=422, detail="Tệp tài liệu rỗng.")
    if len(raw_bytes) > _MAX_DOC_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Tệp tài liệu vượt quá 10 MB ({len(raw_bytes) / 1024 / 1024:.1f} MB).",
        )

    if ext in _TEXT_DOC_EXTS:
        raw_text = raw_bytes.decode("utf-8", errors="replace")
    elif ext == ".docx":
        raw_text = _extract_docx_text(raw_bytes)
    else:
        raw_text = await llm_service.extract_pdf_text_with_gemini(raw_bytes)

    extracted = _normalize_doc_text(raw_text)
    if not extracted:
        raise HTTPException(
            status_code=422,
            detail="Không trích xuất được nội dung chữ từ tệp này. Hãy thử tệp khác hoặc dán nội dung trực tiếp.",
        )

    suggested_topic = re.sub(r"[_-]+", " ", Path(filename).stem).strip() or "Tài liệu học tập"
    return FileExtractResponse(
        filename=filename,
        extracted_text=extracted,
        char_count=len(extracted),
        suggested_topic=suggested_topic,
    )


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
    quiz_id = session_store.create_quiz(shuffled, topic=req.topic)

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
    quiz_entry = session_store.get_quiz_entry(req.quiz_id)
    if quiz_entry is None:
        raise HTTPException(
            status_code=404,
            detail="quiz_id không tồn tại hoặc đã hết hạn (TTL 30 phút). Vui lòng tạo quiz mới.",
        )

    quiz_data = quiz_entry["questions"]
    topic = quiz_entry.get("topic", "")

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
        topic=topic if wrong_items == [] else None,
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

